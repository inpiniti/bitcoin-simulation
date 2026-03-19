"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"

function Calendar({ className, ...props }) {
    return (
        <DayPicker
            className={cn("rdp-market", className)}
            navLayout="around"
            formatters={{
                formatCaption: (date) =>
                    `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
                formatWeekdayName: (date) =>
                    ['일', '월', '화', '수', '목', '금', '토'][date.getDay()],
            }}
            components={{
                Chevron: ({ orientation }) =>
                    orientation === "left"
                        ? <ChevronLeft className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />,
            }}
            {...props}
        />
    )
}

export { Calendar }
