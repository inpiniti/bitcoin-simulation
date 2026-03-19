"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"

function Calendar({ className, ...props }) {
    return (
        <DayPicker
            className={cn("rdp-market", className)}
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
