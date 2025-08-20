/**
 * Derived PEG 관련 유틸리티 함수들
 * Dashboard, Statistics, AdvancedChart 등에서 사용하는 통합 PEG 목록 생성
 */

/**
 * 기본 PEG와 활성화된 Derived PEG를 통합한 전체 PEG 목록 생성
 * @param {Array} basePegs - 기본 PEG 목록 (예: [{value: 'availability', label: 'Availability (%)'}])
 * @param {Array} derivedFormulas - Derived PEG 수식 목록
 * @returns {Array} 통합된 PEG 옵션 배열
 */
export function getCombinedPegOptions(basePegs = [], derivedFormulas = []) {
  // 기본 PEG 목록
  const basePegOptions = basePegs.map(peg => ({
    ...peg,
    type: 'basic',
    source: 'database'
  }))

  // 활성화된 Derived PEG 목록
  const derivedPegOptions = derivedFormulas
    .filter(formula => formula.active)
    .map(formula => ({
      value: formula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
      label: `${formula.name}${formula.unit ? ` (${formula.unit})` : ''} [Derived]`,
      originalName: formula.name,
      description: formula.description,
      formula: formula.formula,
      type: 'derived',
      source: 'calculated',
      dependencies: formula.dependencies || [],
      derivedDependencies: formula.derivedDependencies || []
    }))

  return [
    ...basePegOptions,
    ...derivedPegOptions
  ]
}

/**
 * PEG 목록을 타입별로 그룹핑
 * @param {Array} pegOptions - getCombinedPegOptions에서 반환된 목록
 * @returns {Object} {basic: [], derived: []}
 */
export function groupPegsByType(pegOptions = []) {
  return {
    basic: pegOptions.filter(peg => peg.type === 'basic'),
    derived: pegOptions.filter(peg => peg.type === 'derived')
  }
}

/**
 * 특정 PEG의 의존성 트리 분석 (순환 참조 검사용)
 * @param {string} pegValue - 검사할 PEG 값
 * @param {Array} derivedFormulas - Derived PEG 수식 목록
 * @param {Set} visited - 방문한 PEG 집합 (순환 참조 검사용)
 * @returns {Object} {isValid: boolean, circularRef: string|null, dependencies: Array}
 */
export function analyzePegDependencies(pegValue, derivedFormulas = [], visited = new Set()) {
  // 이미 방문한 PEG면 순환 참조
  if (visited.has(pegValue)) {
    return {
      isValid: false,
      circularRef: pegValue,
      dependencies: []
    }
  }

  // 현재 PEG를 방문 목록에 추가
  const newVisited = new Set(visited)
  newVisited.add(pegValue)

  // 해당 PEG가 Derived PEG인지 확인
  const derivedPeg = derivedFormulas.find(
    f => f.active && f.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() === pegValue
  )

  if (!derivedPeg) {
    // 기본 PEG이므로 순환 참조 없음
    return {
      isValid: true,
      circularRef: null,
      dependencies: []
    }
  }

  // Derived PEG의 의존성 분석
  const allDependencies = [
    ...(derivedPeg.dependencies || []),
    ...(derivedPeg.derivedDependencies || [])
  ]

  for (const dep of allDependencies) {
    const depAnalysis = analyzePegDependencies(dep, derivedFormulas, newVisited)
    if (!depAnalysis.isValid) {
      return depAnalysis
    }
  }

  return {
    isValid: true,
    circularRef: null,
    dependencies: allDependencies
  }
}

/**
 * Derived PEG의 계산 순서 결정 (의존성 기반 토폴로지 정렬)
 * @param {Array} derivedFormulas - Derived PEG 수식 목록
 * @returns {Array} 계산 순서대로 정렬된 수식 목록
 */
export function getCalculationOrder(derivedFormulas = []) {
  const activeFormulas = derivedFormulas.filter(f => f.active)
  const result = []
  const visited = new Set()
  const visiting = new Set()

  function visit(formula) {
    if (visiting.has(formula.id)) {
      // 순환 참조 발견
      throw new Error(`Circular dependency detected: ${formula.name}`)
    }
    
    if (visited.has(formula.id)) {
      return
    }

    visiting.add(formula.id)

    // 의존하는 Derived PEG들을 먼저 처리
    const derivedDeps = formula.derivedDependencies || []
    for (const depName of derivedDeps) {
      const depFormula = activeFormulas.find(
        f => f.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() === depName
      )
      if (depFormula) {
        visit(depFormula)
      }
    }

    visiting.delete(formula.id)
    visited.add(formula.id)
    result.push(formula)
  }

  for (const formula of activeFormulas) {
    if (!visited.has(formula.id)) {
      visit(formula)
    }
  }

  return result
}

/**
 * Derived PEG 수식 평가 (실제 데이터 적용)
 * @param {string} formula - 수식 문자열
 * @param {Object} pegValues - PEG 값들 {pegName: value, ...}
 * @param {number} precision - 소수점 자릿수
 * @returns {number|null} 계산 결과 또는 null (오류 시)
 */
export function evaluateDerivedPegFormula(formula, pegValues = {}, precision = 4) {
  try {
    // 수식에서 PEG 이름을 실제 값으로 치환
    let evaluableFormula = formula

    // 1) ${rawName} 형태의 참조를 우선 치환 (특수문자 포함 원본 peg_name 지원)
    const rawPegNames = Object.keys(pegValues).sort((a, b) => b.length - a.length)
    for (const rawName of rawPegNames) {
      const value = pegValues[rawName]
      if (typeof value === 'number' && !isNaN(value)) {
        const escaped = rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const rawRefRegex = new RegExp(`\\$\\{${escaped}\\}`, 'g')
        evaluableFormula = evaluableFormula.replace(rawRefRegex, value.toString())
      }
    }

    // 2) 안전 토큰(영문/숫자/_ 조합)으로도 치환 지원 (기존 방식 유지)
    const safePegNames = Object.keys(pegValues)
      .filter(k => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k))
      .sort((a, b) => b.length - a.length)
    for (const pegName of safePegNames) {
      const value = pegValues[pegName]
      if (typeof value === 'number' && !isNaN(value)) {
        const regex = new RegExp(`\\b${pegName}\\b`, 'g')
        evaluableFormula = evaluableFormula.replace(regex, value.toString())
      }
    }

    // 수학 함수들 JavaScript 형태로 변환
    evaluableFormula = evaluableFormula.replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
    evaluableFormula = evaluableFormula.replace(/log\(([^)]+)\)/g, 'Math.log($1)')
    evaluableFormula = evaluableFormula.replace(/abs\(([^)]+)\)/g, 'Math.abs($1)')
    evaluableFormula = evaluableFormula.replace(/min\(([^)]+)\)/g, 'Math.min($1)')
    evaluableFormula = evaluableFormula.replace(/max\(([^)]+)\)/g, 'Math.max($1)')
    evaluableFormula = evaluableFormula.replace(/\^/g, '**') // 거듭제곱

    // 안전한 평가 (Function 생성자 사용)
    const result = Function(`"use strict"; return (${evaluableFormula})`)()
    
    if (typeof result === 'number' && !isNaN(result)) {
      return Number(result.toFixed(precision))
    }
    
    return null
  } catch (error) {
    console.error('Derived PEG 수식 평가 오류:', error, 'Formula:', formula)
    return null
  }
}

/**
 * 모든 Derived PEG 값을 계산하여 반환
 * @param {Array} derivedFormulas - Derived PEG 수식 목록
 * @param {Object} basePegValues - 기본 PEG 값들
 * @param {number} precision - 소수점 자릿수
 * @returns {Object} {pegName: calculatedValue, ...}
 */
export function calculateAllDerivedPegs(derivedFormulas = [], basePegValues = {}, precision = 4) {
  try {
    // 계산 순서 결정
    const orderedFormulas = getCalculationOrder(derivedFormulas)
    const derivedValues = {}
    const allValues = { ...basePegValues }

    // 순서대로 계산
    for (const formula of orderedFormulas) {
      const safeName = formula.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
      const calculatedValue = evaluateDerivedPegFormula(formula.formula, allValues, precision)
      
      if (calculatedValue !== null) {
        // 안전 토큰명과 원본 이름 모두에 매핑하여 후속 수식에서 참조 가능하도록 함
        derivedValues[safeName] = calculatedValue
        allValues[safeName] = calculatedValue
        allValues[formula.name] = calculatedValue
      }
    }

    return derivedValues
  } catch (error) {
    console.error('Derived PEG 일괄 계산 오류:', error)
    return {}
  }
}

/**
 * PEG 옵션을 Dashboard/Statistics 컴포넌트에서 사용하기 쉬운 형태로 변환
 * @param {Array} combinedPegs - getCombinedPegOptions 결과
 * @returns {Array} Recharts나 Select 컴포넌트에서 사용 가능한 형태
 */
export function formatPegOptionsForUI(combinedPegs = []) {
  return combinedPegs.map(peg => ({
    value: peg.value,
    label: peg.label,
    type: peg.type,
    color: peg.type === 'derived' ? '#3b82f6' : '#6b7280', // 파란색 vs 회색
    isDerived: peg.type === 'derived',
    description: peg.description,
    formula: peg.formula
  }))
}

