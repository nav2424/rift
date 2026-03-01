'use client'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export function Skeleton({ 
  className, 
  variant = 'rectangular',
  width,
  height 
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-100 rounded'
  
  const variantClasses = {
    text: 'h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded',
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  const classes = `${baseClasses} ${variantClasses[variant]} ${className || ''}`
  
  return (
    <div
      className={classes.trim()}
      style={style}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="p-6 space-y-4 border border-gray-200 rounded-xl bg-gray-50 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton variant="text" width="40%" height={24} />
          <Skeleton variant="text" width="60%" height={20} />
          <div className="flex gap-2">
            <Skeleton variant="rectangular" width={80} height={24} className="rounded-full" />
            <Skeleton variant="rectangular" width={100} height={24} className="rounded-full" />
          </div>
        </div>
        <Skeleton variant="rectangular" width={100} height={40} />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

