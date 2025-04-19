/**
 * アーティファクト関連のユーティリティ関数
 */

import { ArtifactType } from '@/types/artifact';

/**
 * コードブロックの言語を検出する関数
 * @param codeBlock コードブロック
 * @returns 言語名またはnull
 */
export function detectLanguage(codeBlock: string): string | null {
  // コードブロックの最初の行を取得
  const firstLine = codeBlock.split('\n')[0];
  
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
  if (!language) return 'code';
  
  const lang = language.toLowerCase();
  
  if (lang === 'html' || lang === 'htm') {
    return 'html';
  }
  
  if (lang === 'svg') {
    return 'svg';
  }
  
  if (lang === 'markdown' || lang === 'md') {
    return 'markdown';
  }
  
  if (lang === 'mermaid') {
    return 'mermaid';
  }
  
  if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
    return 'react';
  }
  
  return 'code';
}

/**
 * テキストから最初のコードブロックを抽出する関数
 * @param text テキスト
 * @returns コードブロックの情報（言語、内容）または null
 */
export function extractCodeBlock(text: string): { language: string | null; content: string } | null {
  // ```から始まり```で終わるブロックを検出する正規表現
  const regex = /```([\w]*)\n([\s\S]*?)```/;
  const match = text.match(regex);
  
  if (match) {
    return {
      language: match[1] || null,
      content: match[2],
    };
  }
  
  return null;
}

/**
 * テキストからHTMLコードブロックを抽出する関数
 * @param text テキスト
 * @returns HTMLコードまたはnull
 */
export function extractHtmlBlock(text: string): string | null {
  // ```htmlから始まり```で終わるブロックか、<html>タグを含むテキストを検出
  const htmlBlockRegex = /```html\n([\s\S]*?)```/;
  const htmlMatch = text.match(htmlBlockRegex);
  
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1].trim();
  }
  
  // 単純なHTMLタグを検出（<html>または<!DOCTYPE html>で始まる場合）
  if (text.includes('<html>') || text.includes('<!DOCTYPE html>')) {
    return text;
  }
  
  return null;
}

/**
 * テキストから言語付きのコードブロックをすべて抽出する関数
 * @param text テキスト
 * @returns コードブロック情報の配列
 */
export function extractAllCodeBlocks(text: string): { language: string | null; content: string }[] {
  const blocks: { language: string | null; content: string }[] = [];
  const regex = /```([\w]*)\n([\s\S]*?)```/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || null,
      content: match[2],
    });
  }
  
  return blocks;
}
