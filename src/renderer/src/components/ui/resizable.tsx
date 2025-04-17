import React, { createContext, useContext, useState } from "react";

interface ResizablePanelGroupProps {
	direction?: "horizontal" | "vertical";
	children: React.ReactNode;
	className?: string;
}

interface ResizablePanelProps {
	defaultSize?: number;
	minSize?: number;
	maxSize?: number;
	children: React.ReactNode;
	className?: string;
}

interface ResizableHandleProps {
	withHandle?: boolean;
	className?: string;
}

export function ResizablePanelGroup({
	direction = "horizontal",
	children,
	className = "",
}: ResizablePanelGroupProps) {
	return (
		<div
			className={`flex ${direction === "horizontal" ? "flex-row" : "flex-col"} ${className}`}
		>
			{children}
		</div>
	);
}

export function ResizablePanel({
	children,
	className = "",
	defaultSize = 1,
	minSize = 0.2,
	maxSize = 2,
}: ResizablePanelProps) {
	return (
		<div
			className={`flex-grow ${className}`}
			style={{
				flex: defaultSize,
				minWidth: `${minSize * 100}%`,
				maxWidth: `${maxSize * 100}%`,
			}}
		>
			{children}
		</div>
	);
}

export function ResizableHandle({
	withHandle = true,
	className = "",
}: ResizableHandleProps) {
	return (
		<div
			className={`w-1 bg-border hover:bg-primary relative cursor-col-resize ${className}`}
		>
			{withHandle && (
				<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded"></div>
			)}
		</div>
	);
}
