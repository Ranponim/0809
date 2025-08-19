-- 초기 summary 테이블과 인덱스 생성 및 샘플 데이터 삽입
CREATE TABLE IF NOT EXISTS summary (
  id BIGINT PRIMARY KEY,
  host TEXT,
  ne TEXT,
  version TEXT,
  family_name TEXT,
  cellid INTEGER,
  peg_name TEXT,
  datetime TIMESTAMP,
  value DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_summary_datetime ON summary(datetime);
CREATE INDEX IF NOT EXISTS idx_summary_peg_name ON summary(peg_name);
CREATE INDEX IF NOT EXISTS idx_summary_ne ON summary(ne);
CREATE INDEX IF NOT EXISTS idx_summary_cellid ON summary(cellid);

-- 사용자 제공 데이터 1건 삽입
INSERT INTO summary (id, host, ne, version, family_name, cellid, peg_name, datetime, value)
VALUES (
  297758,
  '10.251.196.122',
  'NVGNB#101086',
  'SVR24BVGSKT07',
  'Downlink Active UE Number',
  8418,
  'UeactiveDLAvg(Count)_QCI#130',
  to_timestamp('2025-08-08 08:40', 'YYYY-MM-DD HH24:MI'),
  0
)
ON CONFLICT (id) DO NOTHING;


