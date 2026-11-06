// 방명록 서버 함수 (Netlify Function)
//
// 이 파일은 Netlify 클라우드에서 실행되는 서버 코드다. 정적 공개 폴더에 복사되지 않는다.
// 브라우저는 /.netlify/functions/guestbook 주소로만 이 함수를 호출한다.
//
// - GET  : Supabase에서 최근 글을 최신순으로 읽어 반환
// - POST : { nickname, message } 를 받아 서버에서 다시 검증한 뒤 Supabase에 저장
//
// Supabase 비밀 키는 브라우저에 노출하지 않는다. Netlify 환경변수에서만 읽는다.
// 의존성 없이 Supabase REST API를 fetch로 직접 호출한다 (Netlify Node 18+ 내장 fetch 사용).

const TABLE = "guestbook";

// 입력 규칙 (브라우저와 동일하게 서버에서도 재검증)
const NICK_MIN = 2;
const NICK_MAX = 12;
const MSG_MIN = 1;
const MSG_MAX = 100;

function jsonResponse(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(bodyObj),
  };
}

// 공백 정리 후 길이 검증. 문제가 있으면 오류 메시지를 반환.
function validate(nickname, message) {
  if (typeof nickname !== "string" || typeof message !== "string") {
    return "별명과 메시지를 모두 글자로 입력해주세요.";
  }
  const nick = nickname.trim();
  const msg = message.trim();
  if (nick.length < NICK_MIN || nick.length > NICK_MAX) {
    return `별명은 ${NICK_MIN}~${NICK_MAX}자로 입력해주세요.`;
  }
  if (msg.length < MSG_MIN || msg.length > MSG_MAX) {
    return `메시지는 ${MSG_MIN}~${MSG_MAX}자로 입력해주세요.`;
  }
  return null; // 통과
}

exports.handler = async function (event) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 환경변수가 없으면 서버 설정 오류 (키 값 자체는 노출하지 않음)
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, {
      error: "서버 설정이 완료되지 않았어요. 관리자에게 문의해주세요.",
    });
  }

  // SUPABASE_URL 값이 프로젝트 주소(https://xxx.supabase.co)든,
  // 끝에 /rest/v1 이 붙은 형태든 모두 올바르게 처리한다.
  // 끝의 슬래시와 /rest/v1 을 떼어내어 "프로젝트 기준 주소(origin)"로 정규화한다.
  const origin = supabaseUrl
    .replace(/\/+$/, "")        // 끝 슬래시 제거
    .replace(/\/rest\/v1$/, ""); // 끝에 붙은 /rest/v1 제거
  const restBase = `${origin}/rest/v1/${TABLE}`;
  const commonHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  try {
    if (event.httpMethod === "GET") {
      // 최근 글 최신순 20개
      const url = `${restBase}?select=id,nickname,message,created_at&order=created_at.desc&limit=20`;
      const res = await fetch(url, { headers: commonHeaders });
      if (!res.ok) {
        return jsonResponse(502, { error: "글을 불러오지 못했어요." });
      }
      const rows = await res.json();
      return jsonResponse(200, { items: rows });
    }

    if (event.httpMethod === "POST") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch (_e) {
        return jsonResponse(400, { error: "요청 형식이 올바르지 않아요." });
      }

      const errorMsg = validate(payload.nickname, payload.message);
      if (errorMsg) {
        return jsonResponse(400, { error: errorMsg });
      }

      const record = {
        nickname: payload.nickname.trim(),
        message: payload.message.trim(),
      };

      const res = await fetch(restBase, {
        method: "POST",
        headers: { ...commonHeaders, Prefer: "return=representation" },
        body: JSON.stringify(record),
      });

      if (!res.ok) {
        return jsonResponse(502, { error: "저장에 실패했어요. 다시 시도해주세요." });
      }
      const saved = await res.json();
      return jsonResponse(201, { item: Array.isArray(saved) ? saved[0] : saved });
    }

    return jsonResponse(405, { error: "지원하지 않는 요청이에요." });
  } catch (_e) {
    return jsonResponse(500, { error: "서버 오류가 발생했어요. 다시 시도해주세요." });
  }
};
