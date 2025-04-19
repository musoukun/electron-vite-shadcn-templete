import { highlight } from "sugar-high";
import remarkGfm from "remark-gfm";
import { remark } from "remark";
import { visit } from "unist-util-visit";
import { Node } from "unist";

/**
 * シンタックスハイライトを適用するremarkプラグイン
 * sugar-highを使用してコードブロックをハイライトする
 */
export const remarkSugarHigh = () => {
	return async (tree: Node) => {
		const nodesToHighlight: {
			node: any;
			language: string;
			value: string;
		}[] = [];

		// コードブロックノードを収集
		visit(tree, "code", (node: any) => {
			const lang = node.lang || "text";
			nodesToHighlight.push({
				node,
				language: lang,
				value: node.value,
			});
		});

		// 各ノードに対してハイライトを適用
		for (const item of nodesToHighlight) {
			try {
				// sugar-highでハイライト
				const html = highlight(item.value);

				// ノードの値を更新
				item.node.type = "html";
				item.node.value = `<pre class="sh-code ${item.language}"><code>${html}</code></pre>`;
			} catch (error) {
				console.error(
					`Error highlighting code in language ${item.language}:`,
					error
				);
			}
		}
	};
};

/**
 * ネストされたMarkdownブロックを処理するremarkプラグイン
 */
export const remarkNestedMarkdown = () => {
	return async (tree: Node) => {
		const markdownBlocks: { node: any; value: string }[] = [];

		// Markdownブロックを収集
		visit(tree, "code", (node: any) => {
			if (node.lang === "markdown") {
				markdownBlocks.push({
					node,
					value: node.value,
				});
			}
		});

		// 各Markdownブロックを処理
		for (const item of markdownBlocks) {
			try {
				// 内部のMarkdownをパース
				const innerMarkdown = await remark()
					.use(remarkGfm)
					.use(remarkSugarHigh)
					.process(item.value);

				// ノードをHTMLに変換
				item.node.type = "html";
				item.node.value = `<div class="nested-markdown">${String(innerMarkdown)}</div>`;
			} catch (error) {
				console.error("Error processing nested markdown:", error);
			}
		}
	};
};

/**
 * Markdownテキストをレンダリングする関数
 * コードブロックにsugar-highでシンタックスハイライトを適用
 * ネストされたMarkdownブロックも処理
 * @param markdown Markdownテキスト
 * @returns 処理済みのHTMLテキスト
 */
export async function renderMarkdown(markdown: string): Promise<string> {
	try {
		const result = await remark()
			.use(remarkGfm)
			.use(remarkNestedMarkdown)
			.use(remarkSugarHigh)
			.process(markdown);

		return String(result);
	} catch (error) {
		console.error("Error rendering markdown:", error);
		return markdown;
	}
}

/**
 * Markdownのコードブロックを直接ハイライト（ReactMarkdownコンポーネント用）
 */
export function highlightCode(code: string): string {
	try {
		return highlight(code);
	} catch (error) {
		console.error("Error highlighting code:", error);
		return code;
	}
}
