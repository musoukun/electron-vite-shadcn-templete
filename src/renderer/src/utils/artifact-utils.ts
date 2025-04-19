/**
 * アーティファクト関連のユーティリティ関数
 */

import { ArtifactType } from "@/types/artifact";

/**
 * コードブロックの言語を検出する関数
 * @param codeBlock コードブロック
 * @returns 言語名またはnull
 */
export function detectLanguage(codeBlock: string): string | null {
	// コードブロックの最初の行を取得
	const firstLine = codeBlock.split("\n")[0];

	// ```言語名 の形式を検出
	const match = firstLine.match(/^```(\w+)/);

	if (match && match[1]) {
		return match[1];
	}

	return null;
}

/**
 * 言語からアーティファクトタイプを推測する関数
 * @param language 言語名
 * @returns アーティファクトタイプ
 */
export function inferArtifactType(language: string | null): ArtifactType {
	if (!language) return "code";

	const lang = language.toLowerCase();

	if (lang === "html" || lang === "htm") {
		return "html";
	}

	if (lang === "svg") {
		return "svg";
	}

	if (lang === "markdown" || lang === "md") {
		return "markdown";
	}

	if (lang === "mermaid") {
		return "mermaid";
	}

	if (lang === "jsx" || lang === "tsx" || lang === "react") {
		return "react";
	}

	return "code";
}

/**
 * テキストから最初のコードブロックを抽出する関数
 * @param text テキスト
 * @returns コードブロックの情報（言語、内容）または null
 */
export function extractCodeBlock(
	text: string
): { language: string | null; content: string } | null {
	if (!text) return null;

	// ```から始まり```で終わるブロックを検出する正規表現（より柔軟なパターン）
	const regex = /```(\w*)\s*\n([\s\S]*?)```/;
	const match = text.match(regex);

	if (match) {
		return {
			language: match[1]?.trim() || null,
			content: match[2].trim(),
		};
	}

	return null;
}

/**
 * マークダウンブロックを抽出する
 * @param content マークダウンコンテンツ
 * @returns 抽出されたマークダウンブロック
 */
export function extractMarkdownBlock(content: string): string | null {
	if (!content) return null;

	// コンソールでデバッグ情報
	console.log(
		"マークダウン抽出処理開始: 元のコンテンツ長さ =",
		content.length
	);

	// まず、content自体が明らかにマークダウンかを判断
	// マークダウンによく使われるパターンを確認
	const hasMarkdownPatterns =
		/(^|\n)#{1,6}\s+.+/m.test(content) || // 見出し
		/\*\*[^*]+\*\*/m.test(content) || // 太字
		/\*[^*]+\*/m.test(content) || // 斜体
		/!\[.*?\]\(.*?\)/m.test(content) || // 画像
		/\[.*?\]\(.*?\)/m.test(content) || // リンク
		/^-\s+.+/m.test(content) || // リスト
		/^>\s+.+/m.test(content); // 引用

	// マークダウンのパターンが多数あれば、そのままコンテンツを返す
	if (hasMarkdownPatterns) {
		console.log("マークダウンパターン検出: コンテンツ全体を返します");
		return content;
	}

	// 1. ```markdown ... ``` パターンを探す
	const markdownBlockRegex = /```markdown\s*([\s\S]*?)```/g;
	const matches = [...content.matchAll(markdownBlockRegex)];

	if (matches.length > 0) {
		// すべてのマッチを結合
		const extractedContent = matches
			.map((match) => match[1].trim())
			.join("\n\n");

		console.log(
			"マークダウンブロック抽出成功:",
			extractedContent.substring(0, 100) + "..."
		);
		return extractedContent;
	}

	// 2. 言語指定なしの ```...``` パターンを探す
	const codeBlockRegex = /```\s*\n([\s\S]*?)```/g;
	const codeMatches = [...content.matchAll(codeBlockRegex)];

	if (codeMatches.length > 0) {
		// マークダウンっぽい内容を含むコードブロックがあれば抽出
		for (const match of codeMatches) {
			const blockContent = match[1].trim();
			if (
				blockContent.includes("#") || // 見出し
				blockContent.includes("-") || // リスト
				blockContent.includes("*") || // 強調
				blockContent.includes("[") // リンク
			) {
				console.log(
					"マークダウンっぽいコードブロック検出:",
					blockContent.substring(0, 100) + "..."
				);
				return blockContent;
			}
		}
	}

	// 3. 何も見つからなければ、コンテンツがすでにマークダウンであると仮定
	// マークダウンとして一般的なパターンをいくつか含んでいれば返す
	if (
		content.includes("#") ||
		content.includes("-") ||
		content.includes("```")
	) {
		const lines = content.split("\n");
		// 少なくとも数行あり、かつマークダウンらしい要素が含まれていれば
		if (lines.length > 3) {
			console.log(
				"マークダウンとして認識:",
				content.substring(0, 100) + "..."
			);
			return content;
		}
	}

	return null;
}

/**
 * HTMLブロックを抽出する
 * @param content マークダウンコンテンツ
 * @returns 抽出されたHTMLブロック
 */
export function extractHtmlBlock(content: string): string | null {
	if (!content) return null;

	// デバッグ情報
	console.log("HTML抽出処理開始: 元のコンテンツ長さ =", content.length);

	// 1. ```html ... ``` パターンを探す
	const htmlBlockRegex = /```html\s*([\s\S]*?)```/g;
	const matches = [...content.matchAll(htmlBlockRegex)];

	if (matches.length > 0) {
		const extractedContent = matches
			.map((match) => match[1].trim())
			.join("\n\n");
		console.log(
			"HTMLブロック抽出成功:",
			extractedContent.substring(0, 100) + "..."
		);
		return extractedContent;
	}

	// 2. HTML要素のパターンを探す
	if (
		/<html|<!DOCTYPE html|<body|<div|<p|<h[1-6]|<span|<a|<img|<ul|<ol|<table/i.test(
			content
		)
	) {
		const htmlLines = content.split("\n");
		// HTML要素が多く含まれているかを確認
		let htmlElementCount = 0;
		for (const line of htmlLines) {
			if (/<\/?[a-z][\s\S]*>/i.test(line)) {
				htmlElementCount++;
			}
		}

		// HTML要素が5つ以上あればHTMLとして処理
		if (htmlElementCount >= 5) {
			console.log(
				"HTML要素パターン検出:",
				content.substring(0, 100) + "..."
			);
			return content;
		}
	}

	return null;
}

/**
 * テキストから言語付きのコードブロックをすべて抽出する関数
 * @param text テキスト
 * @returns コードブロック情報の配列
 */
export function extractAllCodeBlocks(
	text: string
): { language: string | null; content: string }[] {
	if (!text) return [];

	const blocks: { language: string | null; content: string }[] = [];
	const regex = /```(\w*)\s*\n([\s\S]*?)```/g;

	let match;
	while ((match = regex.exec(text)) !== null) {
		blocks.push({
			language: match[1]?.trim() || null,
			content: match[2].trim(),
		});
	}

	return blocks;
}
