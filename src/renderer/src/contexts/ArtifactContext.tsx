import React, { createContext, useContext, useState, ReactNode } from "react";
import { Artifact, ArtifactContextType, ArtifactType } from "@/types/artifact";

// デフォルト値を持つコンテキスト
const ArtifactContext = createContext<ArtifactContextType>({
	artifacts: [],
	activeArtifact: null,
	isOpen: false,
	setIsOpen: () => {},
	addArtifact: () => "",
	updateArtifact: () => {},
	setActiveArtifact: () => {},
	removeArtifact: () => {},
});

interface ArtifactProviderProps {
	children: ReactNode;
}

/**
 * アーティファクト管理プロバイダー
 */
export const ArtifactProvider: React.FC<ArtifactProviderProps> = ({
	children,
}) => {
	// アーティファクト一覧
	const [artifacts, setArtifacts] = useState<Artifact[]>([]);
	// 現在アクティブなアーティファクト
	const [activeArtifact, setActiveArtifactState] = useState<Artifact | null>(
		null
	);
	// アーティファクトパネルの表示状態
	const [isOpen, setIsOpen] = useState(false);

	/**
	 * 新しいアーティファクトを追加
	 */
	const addArtifact = (
		artifact: Omit<Artifact, "id" | "created">
	): string => {
		const id = `artifact-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
		const newArtifact: Artifact = {
			...artifact,
			id,
			created: new Date(),
		};

		setArtifacts((prev) => [...prev, newArtifact]);
		return id;
	};

	/**
	 * アーティファクトを更新
	 */
	const updateArtifact = (id: string, updates: Partial<Artifact>) => {
		setArtifacts((prev) =>
			prev.map((art) => (art.id === id ? { ...art, ...updates } : art))
		);

		// アクティブなアーティファクトが更新対象の場合、それも更新
		if (activeArtifact?.id === id) {
			setActiveArtifactState((prev) =>
				prev ? { ...prev, ...updates } : prev
			);
		}
	};

	/**
	 * アクティブなアーティファクトを設定
	 */
	const setActiveArtifact = (id: string | null) => {
		if (id === null) {
			setActiveArtifactState(null);
			return;
		}

		const artifact = artifacts.find((art) => art.id === id);
		setActiveArtifactState(artifact || null);

		// アーティファクトが選択されたら自動的にパネルを開く
		if (artifact) {
			setIsOpen(true);
		}
	};

	/**
	 * アーティファクトを削除
	 */
	const removeArtifact = (id: string) => {
		setArtifacts((prev) => prev.filter((art) => art.id !== id));

		// 削除されたアーティファクトがアクティブだった場合、選択解除
		if (activeArtifact?.id === id) {
			setActiveArtifactState(null);
			setIsOpen(false);
		}
	};

	const value: ArtifactContextType = {
		artifacts,
		activeArtifact,
		isOpen,
		setIsOpen,
		addArtifact,
		updateArtifact,
		setActiveArtifact,
		removeArtifact,
	};

	return (
		<ArtifactContext.Provider value={value}>
			{children}
		</ArtifactContext.Provider>
	);
};

/**
 * アーティファクトコンテキストを使用するためのフック
 */
export const useArtifacts = () => {
	const context = useContext(ArtifactContext);
	if (context === undefined) {
		throw new Error("useArtifacts must be used within an ArtifactProvider");
	}
	return context;
};
