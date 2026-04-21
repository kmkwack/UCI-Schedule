# Reading 39 — Market Organization & Structure

---

## 1. Financial System의 기능

금융시스템(Financial System)은 경제주체들이 **돈, 자산, 리스크, 정보**를 거래할 수 있게 하는 인프라.

- **저축(Save) / 차입(Borrow)**
- **Equity Capital 발행**
- **Risk 관리**
- **자산 교환(Exchange Assets)**
- **정보 활용(Utilize Information)**

---

## 2. Return Determination

금융시스템은 차입과 저축의 양을 균형시키는 **수익률(rate of return)을 결정**하는 메커니즘을 제공.

- 수익률이 **낮으면** → 차입 ↑, 저축 ↓
- 수익률이 **높으면** → 저축 ↑, 차입 ↓
- → **Equilibrium interest rate(균형금리)** 에서 일치

---

## 3. Allocation of Capital

자본은 한정되어 있으므로, 금융시스템의 핵심 기능 중 하나는 **가장 효율적인 곳에 자본을 배분**하는 것.

> 투자자는 기대수익률(E(R))과 리스크를 비교해 선호 투자처를 결정

---

## 4. Classification of Assets

### Financial Assets

- **Debt securities**: 빌린 돈을 갚겠다는 약속 (채권)
- **Equity securities**: 소유권(ownership) 표시 (주식)
- **Public securities**: 거래소/딜러를 통해 거래, 규제 대상
- **Private securities**: 공개시장에서 거래되지 않음, 규제 없음
- **Derivative contracts**: 기초자산(underlying)의 가치에 따라 파생되는 가치
  - Financial derivatives (주식, 채권 기반)
  - Physical derivatives (금, 원유, 밀 등)

### Real Assets

부동산, 설비, 원자재 등 **실물자산**.

---

## 5. Market 분류

| 구분 | 내용 |
|------|------|
| Spot market | 즉시 인도(immediate delivery) |
| Forwards / Futures / Options | 미래 인도 계약 |
| Primary market | 신규 발행 증권 |
| Secondary market | 이미 발행된 증권의 재거래 |
| Money market | 만기 1년 이하 debt |
| Capital market | 장기 debt + equity |
| Traditional | 주식·채권 |
| Alternative | 헤지펀드, 원자재, 부동산, 수집품 |

---

## 6. Type of Assets

### Securities

- **Equity securities**
  - Common stock: 잔여 재산 청구권(residual claim)
  - Preferred stock: 배당이 사전 정해진 우선주
  - Warrants: 주식을 살 수 있는 권리

- **Pooled investment vehicles (집합투자기구)**
  - Mutual funds: Open-end(펀드 자체에서 매수) / Closed-end(2차시장 매수)
  - ETF / ETN: 폐쇄형 펀드처럼 거래되지만 포트폴리오와의 교환이 가능
  - Asset-backed securities: 모기지, 카드론 등 자산 풀에 대한 청구권
  - Hedge funds: Limited Partnership 구조, 부유층 대상

- **Fixed income securities**
  - Bonds (장기)
  - Notes (중기)
  - CP, Commercial Paper (단기)

### 기타

- **Currencies / Commodities / Real Assets**
- **Contracts**: Forward, Futures, Swap, Option, Insurance, CDS

> **ETN이란?** 운용사가 지정 인덱스 수익률을 **보전해주겠다는 채권형 증권**. 실제 자산을 담지 않음.
> **인덱스 펀드 vs ETF** → 인덱스 펀드는 하루 한 번 NAV로 가격 결정, ETF는 **주식처럼 실시간 거래**.

---

## 7. Financial Intermediaries

- **Broker**: 매수·매도자를 매칭 (장외 거래 중개)
  - Block broker: 대량 주문 배치 지원
- **Dealer**: 자기 재고(inventory)로 사고팖 → **Market maker**
  - Bid price, Ask price 제시
  - Spread = Ask − Bid → **딜러 수익의 원천**
- **Exchange**: 거래소
- **Securitizers**: 증권 풀링 후 지분 판매
- **Depository institution**: 예금금융기관
- **Arbitrageur**: 차익거래자
- **Clearing house**: 청산소, 결제 이행 보장
- **Custodians**: 예탁결제원, 주식 보관·명의이전
- **Investment banks**: 기업의 주식·채권 발행 지원

---

## 8. Position

### Long vs Short

- **Long position**: 현물/선물/옵션 매수 → **자산가격 상승 시 이익**
- **Short position**: 공매도/선물/옵션 매도 → **자산가격 하락 시 이익**

> Diversification은 보통 상관관계 낮은 종목으로 Long, **헷지**는 상관관계 높은 종목을 Short.

### Shortsale (공매도)

주식을 **빌려서 팔고** 가격이 떨어지면 더 낮은 가격에 사서 갚는 거래.

- 브로커를 통해 동시에 차입·매도
- Lender 요청 시 즉시 반환해야 함
- 매도대금 일부를 브로커에 **예치(deposit)** 해야 함
- 공매도 기간 동안 발생한 **배당·이자는 lender에게 귀속**
- **Collateral** 예치 필수

### Margin Transaction (신용거래)

돈을 **빌려서 주식을 사고** 가격이 오르면 비싸게 팔아서 갚는 거래.

- **Initial margin (개시증거금)**: 거래 개시 시점에 필요한 자기자본 비율
- **Maintenance margin (유지증거금)**: 거래 중 유지해야 하는 최소 자본 비율
  - 미달 시 → **Margin Call** 발생

---

## 9. Margin Transaction Example

조건:
- Shares = 1,000주, Purchase price = $100 → 총 $100,000
- Initial margin = 40% → 자기자본 $40,000, 차입 $60,000
- Annual dividend = $2.00/share
- Call money rate = 4%
- Commission = $0.05/share
- 1년 후 주가 = $110

$$\text{Leverage Ratio} = \frac{\text{Asset Value}}{\text{Equity}} = \frac{100{,}000}{40{,}000} = 2.5$$

$$\text{Return} = \frac{110{,}000 + 2{,}000 - 2{,}400 - 60{,}000 - 50}{40{,}000} = 23.7\%$$

---

## 10. Margin Call Price Example

조건: 주가 $40, Initial margin 50%, Maintenance margin 25%

- $40 중 $20는 자기자본(E), $20는 차입(D)
- 주가 하락 시 **Equity가 먼저 깎임**
- Maintenance margin 아래로 떨어지면 → Margin Call

$$x = 0.25x + 20 \Rightarrow 0.75x = 20 \Rightarrow x = \$26.67$$

**Margin Call Price = $26.67**

---

## 11. Execution (주문 체결 방식)

### Market Order (시장가 주문)

- 즉시 체결(Executes immediately)
- Best available price로 체결
- → 원치 않는 가격에 체결될 위험

### Limit Order (지정가 주문)

- 지정한 가격 또는 더 나은 가격에 체결
- 가격 concession 걱정 없음
- → 체결되지 않을 가능성 있음

### Hidden / Iceberg Order

- **Hidden order**: 수량이 시장 참여자에게 **전혀 안 보임**
- **Iceberg order**: 수량이 **일부만 보임**
- 대량 주문의 시장 영향을 최소화하기 위한 방법

### Limit Order Book (관련 용어)

- **Best bid / Best offer** = at the market
- **Inside the market**: best bid와 offer 사이
- **Behind the market**: 현재 시장가와 떨어진 호가
- **Marketable order**: 즉시 체결 가능한 호가

---

## 12. Validity (주문의 유효기간)

- **Day order**: 당일 유효
- **Good till cancelled (GTC)**: 취소 전까지
- **Immediate or Cancel (IOC)**: 즉시 체결 안되면 취소
- **Good on close**: 종가 주문
- **Market on close**: 종가를 시장가로 주문
- **Good on open**: 시가 주문
- **Stop orders**:
  - 공매도 포지션 → **Stop-buy** (가격 상승 방어)
  - Long 포지션 → **Stop-sell** (가격 하락 방어)

---

## 13. Clearing

- 거래의 정산(trade settlement)
- Retail 거래는 일반적으로 브로커를 통해 정산

---

## 14. Primary vs Secondary Market

### Primary Capital Market

신규 발행 증권 거래:

- **Seasoned offering**: 이미 상장된 기업의 추가 발행
- **IPO (Initial Public Offering)**: 최초 공개 발행

### Secondary Market

발행 이후 증권이 거래되는 시장 → **유동성(liquidity)과 가격정보 제공**

### IPO 방식

- **Underwritten offering**: IB가 전체 이슈를 사전 협의가로 인수. 미매각 시 IB가 떠안음
- **Best efforts**: 미매각분을 IB가 부담하지 않음
- **Private placement**: IB 도움으로 기관 투자자에게 직접 매각

---

## 15. Market Structures

- **Call market**: 특정 시간에만 거래. Bid·Offer를 모아 **단일 가격으로 체결**
  - (예: 15:20~15:30 동시호가 → 종가 단일가매매)
  - 종가조작 방지 목적
- **Continuous market**: 장중 연속 거래
- **Quote-driven market**: 딜러(Market maker)와 거래 → Dealer market / OTC
- **Order-driven market**: 거래 규칙(order matching rules)에 따라 자동 체결 → 거래소
  - Order matching: 최고 bid, 최저 ask 매칭
- **Brokered market**: 비유동적·특이 자산 → 브로커가 상대방을 찾아 매칭

---

## 16. Well-Functioning Financial System의 특징

- **Operational efficiency**: 낮은 거래비용
- **Informational efficiency**: 정보가 가격에 잘 반영되는가
- **Allocational efficiency**: 자원이 효용 극대화되도록 배분되었는가
  - 투자자 효용 무차별곡선과 Expectation frontier가 접하는 지점
