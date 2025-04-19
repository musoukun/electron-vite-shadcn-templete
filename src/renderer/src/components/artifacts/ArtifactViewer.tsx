import React from "react";
import { Artifact } from "@/types/artifact";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// マークダウンパース用
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlight } from "remark-sugar-high";

interface ArtifactViewerProps {
	artifact: Artifact;
	onClose?: () => void;
}

/**
 * アーティファクト表示コンポーネント
 * 様々な種類のアーティファクトを表示する
 */
export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
	artifact,
	onClose,
}) => {
	// アーティファクトの種類に応じたコンテンツをレンダリング
	const renderContent = () => {
		console.log("artifact", artifact);
		console.log("artifact.content", artifact.content);
		switch (artifact.type) {
			case "code":
				return (
					<ScrollArea className="h-full w-full p-4">
						<div className="prose dark:prose-invert max-w-none">
							<ReactMarkdown
								remarkPlugins={[remarkGfm, highlight]}
								components={{
									code: ({
										node,
										inline,
										className,
										children,
										...props
									}: any) => {
										// オブジェクト変換処理を共通化
										const match = /language-(\w+)/.exec(
											className || ""
										);
										const lang =
											match && match[1]
												? match[1].toLowerCase()
												: "";

										// オブジェクトの適切な文字列変換処理
										// children がReact要素の配列の場合の特別処理
										let content = "";

										if (Array.isArray(children)) {
											console.log(
												"【コードプレビュー:配列検出】React要素の配列を処理します:",
												children.length,
												"個の要素"
											);

											// 要素の配列を適切に処理
											try {
												// React要素から実際のテキスト内容を抽出
												content = children
													.map((child: any) => {
														// React要素からテキスト抽出を試みる
														if (
															typeof child ===
															"string"
														) {
															return child;
														} else if (
															child &&
															typeof child ===
																"object"
														) {
															// propsからchildren（テキスト）を取得
															if (
																child.props &&
																child.props
																	.children
															) {
																if (
																	typeof child
																		.props
																		.children ===
																	"string"
																) {
																	return child
																		.props
																		.children;
																} else if (
																	Array.isArray(
																		child
																			.props
																			.children
																	)
																) {
																	// さらに再帰的に処理
																	return child.props.children
																		.map(
																			(
																				c: any
																			) =>
																				typeof c ===
																				"string"
																					? c
																					: ""
																		)
																		.join(
																			""
																		);
																}
															}
															// JSONとしてオブジェクトの構造を表示
															return JSON.stringify(
																child,
																(
																	key,
																	value
																) => {
																	// Symbol値やReact特殊オブジェクトを文字列化
																	if (
																		typeof value ===
																		"symbol"
																	)
																		return value.toString();
																	// 循環参照防止
																	if (
																		key ===
																			"_owner" ||
																		key ===
																			"_store"
																	)
																		return undefined;
																	return value;
																},
																2
															);
														}
														return "";
													})
													.join("");
											} catch (e) {
												console.error(
													"コードプレビュー: React要素の処理中にエラー:",
													e
												);
												content = String(children);
											}
										} else {
											// 通常の文字列処理
											content = String(children).replace(
												/\n$/,
												""
											);
										}

										// [object Object] の問題を修正
										if (
											content.includes("[object Object]")
										) {
											try {
												// 正規表現を使ってすべての [object Object] パターンを探す
												content = content.replace(
													/(\{[^{}]*\[object Object\][^{}]*\}|\[object Object\])/g,
													(match) => {
														console.log(
															"コードプレビュー: オブジェクト文字列検出:",
															match
														);

														// シンプルな [object Object] だけの場合
														if (
															match ===
															"[object Object]"
														) {
															return "{ 不明なオブジェクト }";
														}

														// 何らかの構造を持つオブジェクトの場合
														try {
															// プロパティ名のパターンを探す
															const propPattern =
																/(\w+)\s*:\s*\[object Object\]/g;
															let foundProps =
																false;
															const parsedObj =
																match.replace(
																	propPattern,
																	(
																		propMatch,
																		propName
																	) => {
																		foundProps =
																			true;
																		return `"${propName}": { "type": "オブジェクト" }`;
																	}
																);

															if (foundProps) {
																// 整形して見やすくする
																const formatted =
																	parsedObj
																		.replace(
																			/\[object Object\]/g,
																			'{ "type": "オブジェクト" }'
																		)
																		.replace(
																			/'/g,
																			'"'
																		)
																		.replace(
																			/(\w+):/g,
																			'"$1":'
																		);

																try {
																	// 可能ならJSONとしてパースして整形
																	const jsonObj =
																		JSON.parse(
																			formatted
																		);
																	return JSON.stringify(
																		jsonObj,
																		null,
																		2
																	);
																} catch (e) {
																	return formatted;
																}
															}

															return "{ 構造不明のオブジェクト }";
														} catch (e) {
															console.error(
																"コードプレビュー: オブジェクト構造の解析に失敗:",
																e
															);
															return "{ パース不能なオブジェクト }";
														}
													}
												);
											} catch (e) {
												console.error(
													"コードプレビュー: オブジェクト変換エラー:",
													e
												);
											}
										}

										// インラインコードの場合
										if (inline) {
											return (
												<code
													className={className}
													{...props}
												>
													{content}
												</code>
											);
										}

										// 通常のコードブロック
										return (
											<div className="relative code-block-wrapper w-full">
												{lang && (
													<div className="absolute top-2 right-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
														{lang}
													</div>
												)}
												<pre
													className={`${className || ""} syntax-highlighted rounded-md p-4 my-2 overflow-x-auto w-full whitespace-pre-wrap break-words`}
												>
													<code
														{...props}
														className={`${className} break-words`}
													>
														{content}
													</code>
												</pre>
											</div>
										);
									},
								}}
							>
								{`\`\`\`${artifact.language || ""}\n${artifact.content || ""}\n\`\`\``}
							</ReactMarkdown>
						</div>
					</ScrollArea>
				);

			case "markdown":
				console.log(
					"マークダウン表示: コンテンツ長さ =",
					artifact.content?.length || 0
				);
				return (
					<ScrollArea className="h-full w-full p-4">
						<div className="prose dark:prose-invert max-w-none">
							<ReactMarkdown
								remarkPlugins={[remarkGfm, highlight]}
								components={{
									code: ({
										node,
										inline,
										className,
										children,
										...props
									}: any) => {
										// App.tsxのコードコンポーネントと同様の処理を実装
										const match = /language-(\w+)/.exec(
											className || ""
										);
										const lang =
											match && match[1]
												? match[1].toLowerCase()
												: "";

										// オブジェクトの適切な文字列変換処理
										// children がReact要素の配列の場合の特別処理
										let content = "";

										if (Array.isArray(children)) {
											console.log(
												"【プレビュー:配列検出】React要素の配列を処理します:",
												children.length,
												"個の要素"
											);

											// 要素の配列を適切に処理
											try {
												// React要素から実際のテキスト内容を抽出
												content = children
													.map((child: any) => {
														// React要素からテキスト抽出を試みる
														if (
															typeof child ===
															"string"
														) {
															return child;
														} else if (
															child &&
															typeof child ===
																"object"
														) {
															// propsからchildren（テキスト）を取得
															if (
																child.props &&
																child.props
																	.children
															) {
																if (
																	typeof child
																		.props
																		.children ===
																	"string"
																) {
																	return child
																		.props
																		.children;
																} else if (
																	Array.isArray(
																		child
																			.props
																			.children
																	)
																) {
																	// さらに再帰的に処理
																	return child.props.children
																		.map(
																			(
																				c: any
																			) =>
																				typeof c ===
																				"string"
																					? c
																					: ""
																		)
																		.join(
																			""
																		);
																}
															}
															// JSONとしてオブジェクトの構造を表示
															return JSON.stringify(
																child,
																(
																	key,
																	value
																) => {
																	// Symbol値やReact特殊オブジェクトを文字列化
																	if (
																		typeof value ===
																		"symbol"
																	)
																		return value.toString();
																	// 循環参照防止
																	if (
																		key ===
																			"_owner" ||
																		key ===
																			"_store"
																	)
																		return undefined;
																	return value;
																},
																2
															);
														}
														return "";
													})
													.join("");
											} catch (e) {
												console.error(
													"プレビュー: React要素の処理中にエラー:",
													e
												);
												content = String(children);
											}
										} else {
											// 通常の文字列処理
											content = String(children).replace(
												/\n$/,
												""
											);
										}

										// [object Object] の問題を修正
										if (
											content.includes("[object Object]")
										) {
											try {
												// 正規表現を使ってすべての [object Object] パターンを探す
												content = content.replace(
													/(\{[^{}]*\[object Object\][^{}]*\}|\[object Object\])/g,
													(match) => {
														console.log(
															"プレビュー: オブジェクト文字列検出:",
															match
														);

														// シンプルな [object Object] だけの場合
														if (
															match ===
															"[object Object]"
														) {
															return "{ 不明なオブジェクト }";
														}

														// 何らかの構造を持つオブジェクトの場合
														try {
															// プロパティ名のパターンを探す
															const propPattern =
																/(\w+)\s*:\s*\[object Object\]/g;
															let foundProps =
																false;
															const parsedObj =
																match.replace(
																	propPattern,
																	(
																		propMatch,
																		propName
																	) => {
																		foundProps =
																			true;
																		return `"${propName}": { "type": "オブジェクト" }`;
																	}
																);

															if (foundProps) {
																// 整形して見やすくする
																const formatted =
																	parsedObj
																		.replace(
																			/\[object Object\]/g,
																			'{ "type": "オブジェクト" }'
																		)
																		.replace(
																			/'/g,
																			'"'
																		)
																		.replace(
																			/(\w+):/g,
																			'"$1":'
																		);

																try {
																	// 可能ならJSONとしてパースして整形
																	const jsonObj =
																		JSON.parse(
																			formatted
																		);
																	return JSON.stringify(
																		jsonObj,
																		null,
																		2
																	);
																} catch (e) {
																	return formatted;
																}
															}

															return "{ 構造不明のオブジェクト }";
														} catch (e) {
															console.error(
																"プレビュー: オブジェクト構造の解析に失敗:",
																e
															);
															return "{ パース不能なオブジェクト }";
														}
													}
												);
											} catch (e) {
												console.error(
													"プレビュー: オブジェクト変換エラー:",
													e
												);
											}
										}

										// インラインコードの場合
										if (inline) {
											return (
												<code
													className={className}
													{...props}
												>
													{content}
												</code>
											);
										}

										// 通常のコードブロック
										return (
											<div className="relative code-block-wrapper w-full">
												{lang && (
													<div className="absolute top-2 right-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
														{lang}
													</div>
												)}
												<pre
													className={`${className || ""} syntax-highlighted rounded-md p-4 my-2 overflow-x-auto w-full whitespace-pre-wrap break-words`}
												>
													<code
														{...props}
														className={`${className} break-words`}
													>
														{content}
													</code>
												</pre>
											</div>
										);
									},
									// 他のマークダウン要素のカスタマイズ
									h1: ({ node, ...props }) => (
										<h1
											{...props}
											className="text-2xl font-bold mt-6 mb-4"
										/>
									),
									h2: ({ node, ...props }) => (
										<h2
											{...props}
											className="text-xl font-bold mt-5 mb-3"
										/>
									),
									h3: ({ node, ...props }) => (
										<h3
											{...props}
											className="text-lg font-bold mt-4 mb-2"
										/>
									),
									p: ({ node, ...props }) => (
										<p {...props} className="my-2" />
									),
									ul: ({ node, ...props }) => (
										<ul
											{...props}
											className="list-disc pl-5 my-2"
										/>
									),
									ol: ({ node, ...props }) => (
										<ol
											{...props}
											className="list-decimal pl-5 my-2"
										/>
									),
									li: ({ node, ...props }) => (
										<li {...props} className="my-1" />
									),
									table: ({ node, ...props }) => (
										<div className="overflow-x-auto my-4">
											<table
												{...props}
												className="min-w-full border-collapse"
											/>
										</div>
									),
									// その他必要に応じて追加
								}}
							>
								{artifact.content || ""}
							</ReactMarkdown>
						</div>
					</ScrollArea>
				);

			case "html":
				return (
					<div className="w-full h-full">
						<iframe
							srcDoc={artifact.content}
							title={artifact.title}
							className="w-full h-full border-0"
							sandbox="allow-scripts"
						/>
					</div>
				);

			case "svg":
				return (
					<div className="flex items-center justify-center w-full h-full p-4 bg-white">
						<div
							dangerouslySetInnerHTML={{
								__html: artifact.content,
							}}
						/>
					</div>
				);

			case "mermaid":
				// Mermaidは事前にクライアントサイドでレンダリングする必要あり
				// 実装は別途必要
				return (
					<div className="w-full h-full p-4 flex items-center justify-center">
						<p>
							Mermaidダイアグラムのプレビューはまだ実装されていません
						</p>
					</div>
				);

			case "react":
				// Reactコンポーネントの動的レンダリングは複雑なため、
				// 実際の実装では別途対応が必要
				return (
					<div className="w-full h-full p-4 flex items-center justify-center">
						<p>
							Reactコンポーネントのプレビューはまだ実装されていません
						</p>
					</div>
				);

			default:
				return (
					<div className="w-full h-full p-4">
						<pre className="whitespace-pre-wrap">
							{artifact.content || ""}
						</pre>
					</div>
				);
		}
	};

	return (
		<Card className="flex flex-col h-full overflow-hidden">
			<CardHeader className="p-2 border-b flex-shrink-0 flex justify-between items-center">
				<CardTitle className="text-sm font-medium">
					{artifact.title}
				</CardTitle>
				{onClose && (
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-6 w-6"
					>
						<X className="h-4 w-4" />
					</Button>
				)}
			</CardHeader>
			<CardContent className="p-0 flex-1 overflow-hidden">
				{renderContent()}
			</CardContent>
		</Card>
	);
};
