"use client"

import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { GoalMetric, GoalStatus } from "@/types"

interface ContentCardProps {
  title: string
  odds: {
    probability: number
    threshold: number
  }[]
  id: string
  metric?: GoalMetric
  deadline?: string
  stakeAmount?: number
  progress?: number
  status?: GoalStatus
  className?: string
}

export function ContentCard({
  title,
  odds,
  id,
  metric,
  deadline,
  stakeAmount,
  progress,
  status,
  className
}: ContentCardProps) {
  const router = useRouter()

  const handleClick = () => {
    router.push(`/content/${id}`)
  }

  const getMetricLabel = (value?: GoalMetric) => {
    switch (value) {
      case "grade":
        return "Grade goal"
      case "fitness":
        return "Fitness goal"
      case "productivity":
        return "Productivity goal"
      case "skill":
        return "Skill goal"
      case "score":
        return "Score goal"
      case "improvement":
        return "Improvement goal"
      default:
        return "Goal"
    }
  }

  const formatProbability = (probability: number) => `${(probability * 100).toFixed(1)}%`

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${className || ""}`}
      onClick={handleClick}
    >
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {getMetricLabel(metric)}{status ? ` · ${status}` : ""}
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
          <div>
            <div className="uppercase tracking-wide text-[10px]">Stake</div>
            <div className="font-medium text-foreground">{typeof stakeAmount === "number" ? stakeAmount.toLocaleString() : "Locked on-chain"}</div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-[10px]">Progress</div>
            <div className="font-medium text-foreground">{typeof progress === "number" ? `${progress}%` : "Tracked on-chain"}</div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-[10px]">Deadline</div>
            <div className="font-medium text-foreground">{deadline || "TBD"}</div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-[10px]">Odds</div>
            <div className="font-medium text-foreground">{formatProbability(odds[0]?.probability || 0)}</div>
          </div>
        </div>
        <div className="space-y-2">
          {odds.map((odd, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-base font-semibold">{odd.threshold}%+</span>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">{formatProbability(odd.probability)}</span>
                <span className="rounded-sm border px-2 py-1 text-xs font-semibold uppercase tracking-wide">Escrow</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
