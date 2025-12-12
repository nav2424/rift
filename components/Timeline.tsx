interface TimelineEvent {
  id: string
  escrowId: string
  type: string
  message: string
  createdById: string | null
  createdAt: Date
  createdBy?: { name: string | null; email: string } | null
}

interface TimelineProps {
  events: TimelineEvent[]
}

export default function Timeline({ events }: TimelineProps) {
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Timeline</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700"></div>
        <div className="space-y-6">
          {sortedEvents.map((event, index) => (
            <div key={event.id} className="relative flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{event.message}</p>
                  <time className="text-xs text-slate-400">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </div>
                {event.createdBy && (
                  <p className="text-xs text-slate-500 mt-1">
                    by {event.createdBy.name || event.createdBy.email}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

