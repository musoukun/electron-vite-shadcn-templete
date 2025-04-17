import { ChatMessage } from "@/types/chat";

/**
 * ユーザーIDを生成または取得する関数
 */
export function generateUserId(): string {
	// ユーザーIDがローカルストレージに保存されていれば使用
	const savedUserId = localStorage.getItem("mastra_user_id");
	if (savedUserId) {
		return savedUserId;
	}

	// 新しいユーザーIDを生成して保存
	const newUserId = `user_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
	localStorage.setItem("mastra_user_id", newUserId);
	return newUserId;
}

// チャンク処理用ヘルパー関数
export function processMessageChunk(text: string): string {
	// 0:"テキスト" 形式
	if (text.startsWith('0:"')) {
		// 0:"から始まるテキストを抽出して解析
		const content = text.substring(3, text.length - 1);
		// バックスラッシュをエスケープ解除
		return content.replace(/\\"/g, '"');
	}

	// data: 形式のチェック（従来のSSE形式）
	if (text.startsWith("data:")) {
		try {
			const dataContent = text.substring(5).trim();
			if (dataContent) {
				const data = JSON.parse(dataContent);
				// テキスト内容を取り出す
				return data.text || data.content || data.delta || "";
			}
		} catch (e) {
			console.error("SSEデータの解析エラー:", e);
		}
		return "";
	}

	// その他の形式はそのまま返す
	return text;
}

/**
 * メッセージのフォーマットを統一する関数
 */
export function formatMessage(message: any): ChatMessage {
	// メッセージが直接文字列の場合（旧フォーマット）
	if (typeof message === "string") {
		return {
			role: "assistant", // デフォルトはAIの応答
			content: message,
		};
	}

	// メッセージがオブジェクトの場合
	const role = message.role || (message.isUser ? "user" : "assistant");

	// contentフィールドの取得
	let content = "";
	if (Array.isArray(message.content) && message.content.length > 0) {
		// contentが配列で、最初の要素にtextプロパティがある場合
		if (message.content[0]?.type === "text" && message.content[0]?.text) {
			content = message.content[0].text;
		} else {
			// 配列だが期待する形式でない場合は、配列全体をJSON文字列化
			content = JSON.stringify(message.content);
		}
	} else if (typeof message.content === "string") {
		// contentが文字列の場合
		content = message.content;
	} else if (message.message) {
		// フォールバック: message プロパティ
		content =
			typeof message.message === "string"
				? message.message
				: JSON.stringify(message.message);
	} else if (message.text) {
		// フォールバック: text プロパティ
		content =
			typeof message.text === "string"
				? message.text
				: JSON.stringify(message.text);
	} else {
		// 上記のいずれでもない場合は、オブジェクト全体をJSON文字列化
		// 不要な情報を取り除く（例: uiMessages）
		const { uiMessages, ...rest } = message;
		content = JSON.stringify(rest);
	}

	return {
		role,
		content,
		id: message.id || message._id,
		createdAt: message.createdAt || message.timestamp,
	};
}
