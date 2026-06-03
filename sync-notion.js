import { Client } from "@notionhq/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. .env 파일의 환경 변수 로드
dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;

if (!NOTION_API_KEY || !NOTION_PAGE_ID) {
  console.error("❌ 에러: .env 파일에 NOTION_API_KEY 또는 NOTION_PAGE_ID가 설정되지 않았습니다.");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

// 2. 마크다운 파일을 읽고 간단한 노션 블록 구조로 파싱하는 함수
function parseMarkdownToNotionBlocks(markdownText) {
  const lines = markdownText.split("\n");
  const blocks = [];

  for (let line of lines) {
    const trimmed = line.trim();

    // 빈 줄 패스
    if (!trimmed) continue;

    // H1 (제목 1)
    if (trimmed.startsWith("# ")) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: trimmed.replace("# ", "") } }]
        }
      });
    }
    // H2 (제목 2)
    else if (trimmed.startsWith("## ")) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: trimmed.replace("## ", "") } }]
        }
      });
    }
    // H3 (제목 3)
    else if (trimmed.startsWith("### ")) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: trimmed.replace("### ", "") } }]
        }
      });
    }
    // 구분선
    else if (trimmed === "---") {
      blocks.push({
        object: "block",
        type: "divider",
        divider: {}
      });
    }
    // 목록 (Bulleted List)
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.substring(2);
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content } }]
        }
      });
    }
    // 일반 본문 문단 (Paragraph)
    else {
      // 굵은 글씨(**텍스트**)가 있으면 임시로 간단히 처리하거나 텍스트로 보냄
      const cleanContent = trimmed.replace(/\*\*/g, "");
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: cleanContent } }]
        }
      });
    }
  }
  return blocks;
}

async function startSync() {
  try {
    const mdPath = path.join(process.cwd(), "docs", "product-scenarios.md");
    if (!fs.existsSync(mdPath)) {
      throw new Error(`마크다운 파일을 찾을 수 없습니다: ${mdPath}`);
    }

    const markdownText = fs.readFileSync(mdPath, "utf-8");
    console.log("📖 1. 로컬 기획서 파일 읽기 완료.");

    const blocks = parseMarkdownToNotionBlocks(markdownText);
    console.log(`🧩 2. 마크다운 파싱 완료 (총 ${blocks.length}개 블록 변환됨).`);

    // 3. 기존 페이지의 자식 블록들 조회 및 전체 삭제
    console.log("🧹 3. 노션 페이지 내 기존 내용 비우는 중...");
    const existingBlocks = await notion.blocks.children.list({ block_id: NOTION_PAGE_ID });
    for (const block of existingBlocks.results) {
      await notion.blocks.delete({ block_id: block.id });
    }

    // 4. 새로운 마크다운 기반 블록들 삽입
    console.log("📤 4. 노션에 새 기획서 내용 업로드 중...");
    // 노션 API 제한(한 번에 최대 100개 블록 추가 가능)을 방지하기 위해 50개씩 쪼개서 업로드합니다.
    const chunkSize = 50;
    for (let i = 0; i < blocks.length; i += chunkSize) {
      const chunk = blocks.slice(i, i + chunkSize);
      await notion.blocks.children.append({
        block_id: NOTION_PAGE_ID,
        children: chunk,
      });
    }

    console.log("✨ 5. 동기화 성공! 노션 기획서가 정상적으로 업데이트되었습니다.");
  } catch (error) {
    console.error("❌ 동기화 실패 에러 발생:", error.message);
  }
}

startSync();
