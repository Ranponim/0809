-- Time1/Time2 비교 기능 테스트 데이터 생성
-- Time1: 2025-08-22 00:00:00 ~ 06:00:00 (6시간)
-- Time2: 2025-08-23 00:00:00 ~ 06:00:00 (6시간)
-- PEG: randomaccessproblem
-- Value: 0~100 사이 랜덤값

-- Time1 데이터 생성 (2025-08-22 00:00:00 ~ 06:00:00, 15분 간격)
INSERT INTO summary (host, ne, version, family_name, cellid, peg_name, datetime, value)
SELECT 
    '10.251.196.122' as host,
    'NVGNB#101086' as ne,
    'SVR24BVGSKT07' as version,
    'Random Access Problem' as family_name,
    8418 as cellid,
    'randomaccessproblem' as peg_name,
    generate_series(
        '2025-08-22 00:00:00'::timestamp,
        '2025-08-22 06:00:00'::timestamp,
        '15 minutes'::interval
    ) as datetime,
    floor(random() * 101)::integer as value;

-- Time2 데이터 생성 (2025-08-23 00:00:00 ~ 06:00:00, 15분 간격)
INSERT INTO summary (host, ne, version, family_name, cellid, peg_name, datetime, value)
SELECT 
    '10.251.196.122' as host,
    'NVGNB#101086' as ne,
    'SVR24BVGSKT07' as version,
    'Random Access Problem' as family_name,
    8418 as cellid,
    'randomaccessproblem' as peg_name,
    generate_series(
        '2025-08-23 00:00:00'::timestamp,
        '2025-08-23 06:00:00'::timestamp,
        '15 minutes'::interval
    ) as datetime,
    floor(random() * 101)::integer as value;

-- 추가 테스트 데이터: 다른 시간대에도 데이터 추가 (더 많은 비교 구간을 위해)
-- 2025-08-22 12:00:00 ~ 18:00:00
INSERT INTO summary (host, ne, version, family_name, cellid, peg_name, datetime, value)
SELECT 
    '10.251.196.122' as host,
    'NVGNB#101086' as ne,
    'SVR24BVGSKT07' as version,
    'Random Access Problem' as family_name,
    8418 as cellid,
    'randomaccessproblem' as peg_name,
    generate_series(
        '2025-08-22 12:00:00'::timestamp,
        '2025-08-22 18:00:00'::timestamp,
        '15 minutes'::interval
    ) as datetime,
    floor(random() * 101)::integer as value;

-- 2025-08-23 12:00:00 ~ 18:00:00
INSERT INTO summary (host, ne, version, family_name, cellid, peg_name, datetime, value)
SELECT 
    '10.251.196.122' as host,
    'NVGNB#101086' as ne,
    'SVR24BVGSKT07' as version,
    'Random Access Problem' as family_name,
    8418 as cellid,
    'randomaccessproblem' as peg_name,
    generate_series(
        '2025-08-23 12:00:00'::timestamp,
        '2025-08-23 18:00:00'::timestamp,
        '15 minutes'::interval
    ) as datetime,
    floor(random() * 101)::integer as value;

-- 다른 Cell ID에도 데이터 추가 (8419)
-- Time1: 2025-08-22 00:00:00 ~ 06:00:00
INSERT INTO summary (host, ne, version, family_name, cellid, peg_name, datetime, value)
SELECT 
    '10.251.196.122' as host,
    'NVGNB#101086' as ne,
    'SVR24BVGSKT07' as version,
    'Random Access Problem' as family_name,
    8419 as cellid,
    'randomaccessproblem' as peg_name,
    generate_series(
        '2025-08-22 00:00:00'::timestamp,
        '2025-08-22 06:00:00'::timestamp,
        '15 minutes'::interval
    ) as datetime,
    floor(random() * 101)::integer as value;

-- Time2: 2025-08-23 00:00:00 ~ 06:00:00
INSERT INTO summary (host, ne, version, family_name, cellid, peg_name, datetime, value)
SELECT 
    '10.251.196.122' as host,
    'NVGNB#101086' as ne,
    'SVR24BVGSKT07' as version,
    'Random Access Problem' as family_name,
    8419 as cellid,
    'randomaccessproblem' as peg_name,
    generate_series(
        '2025-08-23 00:00:00'::timestamp,
        '2025-08-23 06:00:00'::timestamp,
        '15 minutes'::interval
    ) as datetime,
    floor(random() * 101)::integer as value;

-- 데이터 확인 쿼리
-- SELECT COUNT(*) as total_records FROM summary WHERE peg_name = 'randomaccessproblem';
-- SELECT datetime, value FROM summary WHERE peg_name = 'randomaccessproblem' AND cellid = 8418 ORDER BY datetime LIMIT 10;
