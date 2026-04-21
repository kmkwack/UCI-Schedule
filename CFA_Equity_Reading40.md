# Reading 40 — Security Market Indexes

---

## 1. Security Market Index 개요

**자산군, 증권시장, 특정 섹터의 실적을 보여주는 지수**.

- 예: 한국종합주가지수(KOSPI), KOSPI200, S&P500, Dow Jones 30 등
- 시장 전체 또는 특정 세그먼트의 성과를 추적

---

## 2. Price Index vs Return Index

기준년도의 지수를 **100**으로 잡고 복리수익률로 현재 지수를 계산.

### Price Index → Price Return

$$\text{Price Return} = \frac{V_1 - V_0}{V_0}$$

### Return Index → Total Return

$$\text{Total Return} = \frac{V_1 - V_0 + \text{Income(div or int)}}{V_0}$$

> 배당/이자를 포함하면 Return Index(Total Return), 포함하지 않으면 Price Index

---

## 3. Index 구성 시 결정 사항

지수를 만들 때 고려해야 할 5가지:

- **Target market**: 어떤 시장을 추적? (예: 미국 + 주식)
- **Which securities?**: 편입 종목 (예: 시가총액 상위 500)
- **Weighting**: 어떤 가중치? (가격 / 시가총액 등)
- **Rebalancing**: 가중치 재조정 주기
- **Reconstitution**: 종목 교체 방식

---

## 4. Weighting Methods

### Price-Weighted Index

- 편입 종목 **가격의 산술평균(arithmetic average)**
- 초기에는 평균 그 자체를 인덱스 100으로 설정
- 계산이 단순함

특징:
- **High-price stock이 큰 영향** (가격이 높을수록 비중↑)
- 주식분할(stock split) 시 **divisor 조정** 필요 → 안 하면 인덱스 급락
- Simple

---

### Equal-Weighted Index

- 각 종목 수익률의 **산술평균**
- 모든 종목에 동일한 비중 투자한 포트폴리오와 동일

특징:
- **Frequent rebalancing** 필요 (가격 변동 시 비중 깨짐)
- 리밸런싱 안 하면 더 이상 equal-weighted가 아님
- Under-/Over-representation 자주 발생
- Simple

---

### Market Capitalization-Weighted Index (Value-Weighted)

- 각 종목의 **시가총액 비중** 기반

$$w_i = \frac{\text{MktCap}_i}{\sum \text{MktCap}}$$

$$\text{Index Return} = \sum w_i \times R_i$$

특징:
- **High-market-cap 종목이 큰 영향**
- 회사 가치와 가중치가 연동됨
- **Momentum strategy**와 유사

---

## 5. Weighting Methods 예제

| 종목 | 주가 | 수량 | MktCap |
|------|------|------|--------|
| A | 100 → 110 | 10 | 1,000 → 1,100 |
| B | 50 → 50 | 30 | 1,500 → 1,500 |

### 1) Price-weighted

$$\frac{100+50}{2}=75 \Rightarrow \frac{110+50}{2}=80$$

$$\text{Return} = \frac{80-75}{75}=6.7\% \Rightarrow \text{Index: } 100 \to 106.7$$

### 2) Equal-weighted

A에 $100, B에 $100 투자:
- A: $100 → $110 (10%)
- B: $100 → $100 (0%)

$$\text{Return} = \frac{10\% + 0\%}{2} = 5\% \Rightarrow \text{Index: } 100 \to 105$$

### 3) Market-cap weighted

- A 비중: 1,000 / 2,500 = **40%**
- B 비중: 1,500 / 2,500 = **60%**

$$(10\% \times 0.4) + (0\% \times 0.6) = 4\% \Rightarrow \text{Index: } 100 \to 104$$

---

## 6. Rebalancing (가중치 재조정)

가격 변화로 흐트러진 포트폴리오 비중을 **원래 weight로 복원**.

- Price·Value-weighted는 가격변동으로 **자동 조정**됨
- → **Rebalancing은 주로 Equal-weighted의 문제**

---

## 7. Reconstitution (종목 구성 변경)

주기적으로 지수 편입 종목을 **추가·삭제**.

- 기준 미달 종목 → 제외
- 기준 충족 종목으로 대체

---

## 8. Uses of Market Indexes

- **Reflection of market sentiment** (시장 심리 반영)
- **Benchmark of manager performance**
  - 펀드매니저라면 최소한 시장 수익률은 이겨야 함 → **Alpha**
- **Measure of market return and risk**
- **Measure of beta and risk-adjusted return**
  - CAPM에서 주식의 기대수익률 계산 시 베타와 시장수익률 추정 필요

$$\text{CAPM: } R_i = R_f + \beta_i [E(R_m) - R_f]$$

- **Model portfolios** for index funds and ETFs

---

## 9. Types of Equity Indexes

### Broad Market Index

- 시장 전체 성과 반영
- 보통 **시장 전체 가치의 90% 이상** 포함
- 예: Wilshire 5000 Total Market Index

### Multi-Market Index

여러 국가의 지수를 통합한 지수.

---

## 10. Weighting Methods 비교 요약

| 방식 | 영향력 큰 종목 | 단점 | 장점 |
|------|----------------|------|------|
| Price-weighted | 고가주 | 주식분할 시 자의적 변동 | Simple |
| Equal-weighted | 모두 동일 | Frequent rebalancing 필요 | Simple |
| Market-cap weighted | 시총 큰 종목 | Momentum bias | 가치 기반 |
