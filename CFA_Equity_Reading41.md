# Reading 41 — Equity Valuation: Concepts and Basic Tools

---

## 1. Dividend Discount Model (DDM)

주식의 가치는 **미래에 받게 될 모든 배당의 현재가치**.

$$V_0 = \sum_{t=1}^{\infty} \frac{D_t}{(1+K_e)^t}$$

- $V_0$: Current stock value (intrinsic value)
- $D_t$: Dividend at time $t$
- $K_e$: Required rate of return on common equity

> **V ≠ P** : Intrinsic Value ≠ Market Price

### One-Year Holding Period DDM

$$\text{Value} = \frac{D_1}{(1+K_e)} + \frac{P_1}{(1+K_e)}$$

### Multi-Year Holding Period DDM

$$\text{Value} = \frac{D_1}{(1+K_e)} + \frac{D_2}{(1+K_e)^2} + \frac{P_2}{(1+K_e)^2}$$

### Example

조건: $D_0 = \$1.50$, $g = 8\%$, $K_e = 12\%$, 3년 후 매도가 $51.00

- $D_1 = 1.5(1.08)$
- $D_2 = 1.5(1.08)^2$
- $D_3 = 1.5(1.08)^3$, $P_3 = 51$
- → 각 현금흐름을 $K_e$로 할인해서 현재가치 합산

---

## 2. Free Cash Flow to Equity (FCFE)

주주에게 지급될 수 있는 현금 → **배당 지급 능력**을 반영.

$$\text{FCFE} = \text{NI} + \text{D\&A} - \text{NWC} - \text{CAPEX} + \text{Net Borrowing}$$

$$= \text{CFO} - \text{CAPEX} + \text{Net Borrowing (borrowed - repaid)}$$

$$V_0 = \sum_{t=1}^{\infty} \frac{\text{FCFE}_t}{(1+K_e)^t}$$

---

## 3. Estimating the Required Return for Equity

### CAPM (Capital Asset Pricing Model)

$$K_i = R_f + \beta_i [E(R_m) - R_f]$$

- $\beta_i$: 주식의 변동성 (위험)
- $[E(R_m) - R_f]$: 시장위험프리미엄

---

## 4. Preferred Stock Valuation

우선주는 **고정된 배당**을 무한히(indefinite maturity) 지급.

$$\text{Preferred Value} = \frac{D_p}{(1+K_p)} + \frac{D_p}{(1+K_p)^2} + \ldots = \frac{D_p}{K_p}$$

### Example

액면 $100, 배당 $5, 요구수익률 8%

$$V = \frac{5}{0.08} = \$62.5$$

---

## 5. Gordon Growth Model (Constant Growth DDM)

배당이 **일정한 비율 g**로 영구 성장한다고 가정.

$$V_0 = \frac{D_0(1+g_c)}{(1+K_e)} + \frac{D_0(1+g_c)^2}{(1+K_e)^2} + \ldots$$

이는 첫째항이 $\frac{D_1}{1+K_e}$, 공비가 $\frac{1+g_c}{1+K_e}$인 **무한등비급수**.

> **수렴 조건**: $K_e > g_c$ — $K_e < g_c$이면 수학적으로 성립 불가

무한등비급수 합 공식:

$$S = \frac{a}{1-q}$$

이를 적용하면:

$$V_0 = \frac{D_1}{K_e - g_c}$$

### Example

$D_0 = \$1.5$, $g = 8\%$, $K_e = 12\%$

$$V_0 = \frac{1.5 \times 1.08}{0.12 - 0.08} = \$40.50$$

---

## 6. Ke와 Gc의 관계

주식 가치는 $K_e$와 $g_c$의 **차이**에 의해 결정됨.

- $K_e - g_c$ 차이가 **벌어지면** → 주식가치 **하락**
- 차이가 **좁아지면** → 주식가치 **상승**
- 작은 차이 변화가 가치에 **큰 영향**

해석:
- $K_e$가 크다 = 주식이 **위험하다(변동성↑)** → 위험 주식의 가치는 안정 주식보다 낮음
- $g_c$가 크다 = 배당성장 기대↑ → 가치↑
- → **$K_e$는 작을수록, $g_c$는 클수록** 좋음

---

## 7. Estimating Growth Rate in Dividends

배당 성장률 추정 방법 3가지:

1. **Historical**: 과거 배당 성장률 사용
2. **Industry median**: 산업 평균 배당 성장률 사용
3. **Sustainable Growth Rate** 추정

### Sustainable Growth Rate

ROE가 일정하고, 배당성향이 일정하며, 신규 자본 발행이 없다고 가정할 때, 영구히 성장 가능한 비율:

$$g = (1 - \text{Dividend Payout Ratio}) \times \text{ROE} = \text{Retention Rate} \times \text{ROE}$$

### Example

조건: NI = 100, Payout = 30 (Payout ratio 0.3), Retention 70 (Retention rate 0.7), ROE 10%

$$g = 0.7 \times 10\% = 7\%$$

$$D_1 = E_0 \times \text{Payout Ratio} \times (1+g) = 100 \times 0.3 \times 1.07 = 32.1$$

---

## 8. A Firm with No Current Dividend

현재 배당이 없는 기업도 미래 배당이 시작될 시점부터 DDM으로 평가 가능.

조건: $E_4 = 1.64$, Payout 50%, $g = 5\%$, $K_e = 10\%$

- $D_4 = E_4 \times 0.5 = \$0.82$ → $D_4$를 알면 $D_3$도 추정 가능

3년 시점 가치:

$$V_3 = \frac{D_4}{K_e - g_c} = \frac{0.82}{0.10 - 0.05} = \$16.4$$

현재 가치:

$$V_0 = \frac{16.4}{(1.1)^3} = 12.32$$

---

## 9. Multi-Stage Dividend Growth Model

성장률이 단계별로 다른 경우.

$$V_n = \frac{D_{n+1}}{K_e - g_c}$$

### Example

조건: 처음 2년 15%씩 성장, 그 후 영구히 5% 성장, $K_e = 11\%$

- $D_0 = \$1$
- $D_1 = 1.15$
- $D_2 = 1.32$
- $D_3 = 1.386$ (이후 5% 영구 성장)

2년 시점에서 본 영구가치:

$$V_2 = \frac{D_3}{K_e - g_c} = \frac{1.386}{0.11 - 0.05} = \$23.1$$

> $V_n$은 미래 배당의 현재가치인데 **n시점 기준**의 가치 → n=2 시점의 배당($D_2$)은 별도로 더해서 할인해야 함

$$V_0 = \frac{1.15}{1.11} + \frac{1.32 + 23.1}{(1.11)^2}$$

---

## 10. Appropriate Models 선택

| 모델 | 적합 기업 |
|------|-----------|
| Gordon Growth | 안정적·성숙·non-cyclical 배당 지급 기업 |
| Multistage | 빠른/느린/비정상 성장 기업 |
| 3-Stage | High growth → 전환기 → 안정 성장 (예: young firm) |

---

## 11. Relative Valuation Measures: Multiples

### Price Multiples 구조

$$\text{Value} = \text{Per-Share Metric (나의 것)} \times \text{Multiple (Peer 들의 것)}$$

| 분자 | Multiple |
|------|----------|
| EPS | P/E (PER) |
| BPS | P/B (PBR) |
| Sales per share | P/S |
| CF per share | P/CF |

판정:
- $\text{EPS} \times \text{P/E} > \text{Price}$ → **저평가(Undervalued)**

---

## 12. Multiples Based on Fundamentals — Justified P/E

Gordon Growth Model에서 출발:

$$P_0 = \frac{D_1}{K - g}$$

양변을 $E_1$로 나누면:

$$\frac{P_0}{E_1} = \frac{D_1/E_1}{K - g} = \frac{\text{Payout Ratio}}{K - g}$$

→ **Justified P/E**:

$$\text{Justified P/E} = \frac{\text{Payout Ratio}}{K - g}$$

> 주식이 거래되어야 할 적정 가격의 benchmark

---

## 13. Multiples Based on Comparables

### 비교 기준

- **Time series comparison**: 자신의 과거치와 비교
- **Cross-sectional comparison**: 동종 산업 평균과 비교
- 경제 원리: **Law of One Price**

### 단점

- 기업 규모/산업/성장률이 다르면 비교 어려움
- Cyclical firm은 P/E의 경기 민감도 때문에 어려움 → **EPS 불안정 시 Sales/CF 사용**
- Comparable 방법으로 overvalued인데 Fundamental 방법으로는 undervalued인 경우 발생
- Different accounting method → NI끼리 비교 불가
- Cyclical 기업의 multiples는 시점별 경제 상황에 큰 영향

### 정리

Price Multiple 평가 방법은:
1. **Fundamental** (Justified P/E 구해서 비교)
2. **Comparable** (자신 과거치 / 동종 산업 비교)

→ 각각 장단점이 있음

---

## 14. Enterprise Value (EV) Multiples

### Enterprise Value 정의

$$\text{EV} = \text{Market Value of Equity (CS+PS)} + \text{Market Value of Debt} - \text{Cash and Investments}$$

> **인수자 관점**: D + E를 모두 사야 하지만, Cash와 Short-term Investments는 회수 가능 → 차감

### EV/EBITDA 활용 단계

1. Peer EV 구한 후 Peer EBITDA로 멀티플 계산
2. Target에 적용:

$$\text{EV}_{\text{target}} = \text{EBITDA}_{\text{target}} \times \frac{\text{EV}}{\text{EBITDA}_{\text{peer}}}$$

3. Equity Value 도출:

$$\text{Equity Value} = \text{EV}_{\text{target}} + \text{Cash} - \text{Debt} - \text{PS}$$

4. **시가총액과 비교** → 고평가/저평가 판단

---

## 15. EV/EBITDA를 사용하는 이유

- 가장 자주 쓰이는 EV multiples 분모
- EV는 **총 기업가치(D+E)** → 분자도 D와 E 모두에 귀속되는 **earnings**여야 일관성 있음 (operating income도 사용 가능)
- **EBITDA는 NI보다 자주 양수**
- NI는 자본구조 영향을 많이 받음 → 자본구조 다른 기업 비교 시 PER은 어려움
- **EV/EBITDA는 자본구조 영향이 적어 비교에 유리**

### 사고 흐름 정리

> EV/EBITDA = "회사가 채권자+주주의 돈으로 벌어들이는 돈에 비해 몇 배의 가치로 인정받는가?"
> → 우리 회사가 이만큼 버니까 우리 회사 가치는 이정도 → 주식 가치는 이정도 → 시가총액과 비교

---

## 16. Asset-Based Valuation

$$\text{Value} = \text{MV of Assets} - \text{MV of Liabilities}$$

### 적합한 경우

- 주로 유형자산 보유 기업
- 자산이 시장가치 명확 (금융사·천연자원 기업)
- **청산(liquidation) 시나리오**

### 잠재적 문제

- 시장가치 측정 어려움
- Book value vs Market value 차이 큼
- 무형자산(Intangibles) 평가 어려움
- 하이퍼인플레이션 환경에서 부정확

---

## 17. Equity Valuation Models 장단점

### Present Value Models (DDM, FCFE)

**장점**: 이론적으로 우수
**단점**:
- Input은 추정치 → 불확실성 큼 ($K$, $g$ 모두 추정)
- 가치평가가 input에 매우 민감

### Multiplier Models (Multiples)

**장점**: 계산·이해 쉬움

**단점**:
- Fundamental vs Comparable 결과 상충 가능성
- Accounting method 다른 회사 간 비교 어려움 (특히 국가 간)
- Cyclical firm은 경제 상황에 큰 영향
- Industry/Size/Growth 다른 회사 간 비교 어려움
- 분모가 음수면 사용 불가

### Asset-Based Models

**장점**: 청산가치 명확
**단점**: 무형자산·인플레이션 환경에서 부정확
