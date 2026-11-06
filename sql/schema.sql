-- 방명록 테이블 생성 SQL
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행한다.

create table if not exists public.guestbook (
  id          bigint generated always as identity primary key,
  nickname    text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);

-- 최신순 조회를 빠르게 하기 위한 인덱스
create index if not exists guestbook_created_at_idx
  on public.guestbook (created_at desc);

-- Row Level Security(RLS) 켜기.
-- RLS를 켜면 일반(anon) 키로는 접근할 수 없다.
-- 우리 서버 함수는 service_role 키를 쓰는데, service_role 은 RLS를 우회하므로
-- 저장/조회가 정상 동작한다. 즉 "서버 함수만 접근, 브라우저 직접 접근 차단" 이 된다.
alter table public.guestbook enable row level security;

-- 참고: 아래처럼 정책을 하나도 만들지 않으면 anon/authenticated 역할은 접근 불가.
-- service_role 키(서버 함수 전용)는 정책과 무관하게 접근 가능하다.
