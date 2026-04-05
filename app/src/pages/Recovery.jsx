import { useNavigate } from 'react-router-dom'
import RestDayHub from '../components/RestDayHub'
import { RiArrowLeftLine } from '@remixicon/react'

export default function Recovery() {
  const navigate = useNavigate()

  return (
    <div className="page" style={{ paddingBottom: 32 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="icon-btn" onClick={() => navigate(-1)}>
          <RiArrowLeftLine size={22} />
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>Recovery & Rest</h1>
      </div>
      <RestDayHub />
    </div>
  )
}
