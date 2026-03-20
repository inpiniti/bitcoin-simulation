"use client"

import * as React from "react"
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { cn } from "@/lib/utils"

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuGroup = ContextMenuPrimitive.Group
const ContextMenuSub = ContextMenuPrimitive.Sub
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

function ContextMenuContent({ className, ...props }) {
    return (
        <ContextMenuPrimitive.Portal>
            <ContextMenuPrimitive.Content
                className={cn(
                    "z-50 min-w-[8rem] overflow-hidden rounded-md border border-[#3e3e42] bg-[#1e1e1e] p-1 text-white shadow-md",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                    className
                )}
                {...props}
            />
        </ContextMenuPrimitive.Portal>
    )
}

function ContextMenuItem({ className, inset, ...props }) {
    return (
        <ContextMenuPrimitive.Item
            className={cn(
                "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] outline-none transition-colors",
                "hover:bg-[#2a2d2e] focus:bg-[#2a2d2e]",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                inset && "pl-8",
                className
            )}
            {...props}
        />
    )
}

function ContextMenuSeparator({ className, ...props }) {
    return (
        <ContextMenuPrimitive.Separator
            className={cn("-mx-1 my-1 h-px bg-[#3e3e42]", className)}
            {...props}
        />
    )
}

function ContextMenuLabel({ className, inset, ...props }) {
    return (
        <ContextMenuPrimitive.Label
            className={cn(
                "px-2 py-1.5 text-[11px] font-semibold text-[#9d9d9d]",
                inset && "pl-8",
                className
            )}
            {...props}
        />
    )
}

export {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuPortal,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuLabel,
    ContextMenuGroup,
    ContextMenuSub,
    ContextMenuRadioGroup,
}
