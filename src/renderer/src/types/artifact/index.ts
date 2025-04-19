/**
 * Artifact型定義
 * AIの出力を特殊なプレビュー表示するための型
 */

export type ArtifactType = 
  | "code"           // コード表示
  | "markdown"       // マークダウン表示
  | "html"           // HTML表示（iframe内）
  | "svg"            // SVG画像表示
  | "mermaid"        // Mermaidダイアグラム
  | "react";         // Reactコンポーネント

export interface Artifact {
  id: string;         // 一意のID
  type: ArtifactType; // アーティファクトの種類
  title: string;      // 表示タイトル
  content: string;    // コンテンツ（テキスト）
  language?: string;  // コードの場合の言語
  created: Date;      // 作成日時
}

/**
 * アーティファクト管理用のコンテキスト型
 */
export interface ArtifactContextType {
  artifacts: Artifact[];
  activeArtifact: Artifact | null;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  addArtifact: (artifact: Omit<Artifact, 'id' | 'created'>) => string;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
  setActiveArtifact: (id: string | null) => void;
  removeArtifact: (id: string) => void;
}