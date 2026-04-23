import React from 'react'

export default function Skeleton({ width = '100%', height = 16, radius, className = '', style, ...rest }) {
  return (
    <div
      className={`v2-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: radius !== undefined ? radius : undefined,
        ...style,
      }}
      aria-hidden
      {...rest}
    />
  )
}
