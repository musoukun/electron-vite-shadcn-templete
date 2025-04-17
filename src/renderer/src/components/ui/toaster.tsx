import React, { createContext, useContext, useState } from "react";

interface Toast {
	id: string;
	title?: string;
	description?: string;
	type?: "default" | "success" | "error" | "warning";
	duration?: number;
}

interface ToasterContextType {
	toasts: Toast[];
	addToast: (toast: Omit<Toast, "id">) => void;
	dismissToast: (id: string) => void;
}

const ToasterContext = createContext<ToasterContextType | undefined>(undefined);

export function ToasterProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const addToast = (toast: Omit<Toast, "id">) => {
		const id = Math.random().toString(36).substring(2, 9);
		setToasts((prev) => [...prev, { ...toast, id }]);

		// 自動的に消える場合
		if (toast.duration !== Infinity) {
			setTimeout(() => {
				dismissToast(id);
			}, toast.duration || 3000);
		}
	};

	const dismissToast = (id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	};

	return (
		<ToasterContext.Provider value={{ toasts, addToast, dismissToast }}>
			{children}
			<Toaster />
		</ToasterContext.Provider>
	);
}

export function useToast() {
	const context = useContext(ToasterContext);
	if (!context) {
		throw new Error("useToast must be used within a ToasterProvider");
	}
	return context;
}

export function Toaster() {
	const { toasts, dismissToast } = useToast();

	return (
		<div className="fixed bottom-0 right-0 z-50 p-4 space-y-4 max-w-md">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={`bg-white rounded-lg border shadow-lg p-4 ${
						toast.type === "error"
							? "border-red-500"
							: toast.type === "success"
								? "border-green-500"
								: toast.type === "warning"
									? "border-yellow-500"
									: "border-gray-200"
					}`}
				>
					{toast.title && (
						<h3 className="font-semibold">{toast.title}</h3>
					)}
					{toast.description && (
						<p className="text-sm mt-1">{toast.description}</p>
					)}
					<button
						onClick={() => dismissToast(toast.id)}
						className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
					>
						×
					</button>
				</div>
			))}
		</div>
	);
}
