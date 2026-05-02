const TRUSTPILOT_URL = 'https://nl.trustpilot.com/review/rep-max.app'
const MIN_RATING = 3.5
const MAX_REVIEWS = 6

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) {
    throw new Error('Trustpilot page payload not found')
  }

  return JSON.parse(match[1])
}

function normalizeReview(review) {
  return {
    id: review.id,
    title: review.title || '',
    text: review.text || '',
    rating: Number(review.rating || 0),
    publishedDate: review.dates?.publishedDate || null,
    consumer: {
      displayName: review.consumer?.displayName || 'Trustpilot reviewer',
      countryCode: review.consumer?.countryCode || null,
      imageUrl: review.consumer?.imageUrl || '',
      numberOfReviews: Number(review.consumer?.numberOfReviews || 0)
    },
    verification: {
      isVerified: Boolean(review.labels?.verification?.isVerified),
      level: review.labels?.verification?.verificationLevel || null
    }
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await fetch(TRUSTPILOT_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; REPMAXTrustpilotFetcher/1.0; +https://www.rep-max.app/)',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8'
      }
    })

    if (!response.ok) {
      throw new Error(`Trustpilot request failed with ${response.status}`)
    }

    const html = await response.text()
    const payload = extractNextData(html)
    const pageProps = payload?.props?.pageProps || {}
    const businessUnit = pageProps.businessUnit || {}
    const reviews = Array.isArray(pageProps.reviews) ? pageProps.reviews : []

    const qualifyingReviews = reviews
      .filter((review) => !review.filtered && !review.isPending && Number(review.rating || 0) >= MIN_RATING)
      .slice(0, MAX_REVIEWS)
      .map(normalizeReview)

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400')
    return res.status(200).json({
      business: {
        name: businessUnit.displayName || 'REPMAX',
        trustScore: Number(businessUnit.trustScore || 0),
        stars: Number(businessUnit.stars || 0),
        numberOfReviews: Number(businessUnit.numberOfReviews || 0),
        score: businessUnit.score === null || businessUnit.score === undefined ? null : Number(businessUnit.score)
      },
      minimumRating: MIN_RATING,
      reviews: qualifyingReviews,
      hasQualifyingReviews: qualifyingReviews.length > 0,
      sourceUrl: TRUSTPILOT_URL,
      fetchedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[REPMAX] Trustpilot reviews fetch failed:', error)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
    return res.status(200).json({
      business: {
        name: 'REPMAX',
        trustScore: 0,
        stars: 0,
        numberOfReviews: 0,
        score: null
      },
      minimumRating: MIN_RATING,
      reviews: [],
      hasQualifyingReviews: false,
      sourceUrl: TRUSTPILOT_URL,
      fetchedAt: new Date().toISOString(),
      error: 'unavailable'
    })
  }
}
