type MilestoneDateInput = {
  dueDate: string
}

export function validateMilestoneDates(
  milestones: MilestoneDateInput[],
  serviceDate?: string | null
): string | null {
  for (let i = 0; i < milestones.length; i += 1) {
    const currentDate = new Date(`${milestones[i].dueDate}T00:00:00`)
    if (Number.isNaN(currentDate.getTime())) {
      return `Milestone ${i + 1} has an invalid due date`
    }

    if (i > 0) {
      const prevDate = new Date(`${milestones[i - 1].dueDate}T00:00:00`)
      if (currentDate <= prevDate) {
        return 'Each milestone date must be after the previous milestone date'
      }
    }

    if (serviceDate) {
      const finalServiceDate = new Date(`${serviceDate}T00:00:00`)
      if (currentDate > finalServiceDate) {
        return 'Final milestone date cannot be after the service delivery date'
      }
    }
  }

  return null
}
