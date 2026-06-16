# Auditoria de Conformidade — Simulador da Reforma Tributária
**Base legal verificada:** LC 214/2025 e LC 227/2026 (texto oficial do Planalto, lido na íntegra)
**Data:** 02/06/2026 · **Fase A — diagnóstico (nenhuma alteração aplicada ao sistema)**

> Padrão de alíquota de referência adotado nesta auditoria, por decisão do escritório: **28%** (CBS ~9,3% + IBS ~18,7%).

---

## 1. Sumário executivo

| Gravidade | Qtde | O que é |
|---|---|---|
| 🔴 CRÍTICA | 1 | Erro de cálculo que afeta projeções exibidas ao cliente |
| 🟠 ALTA | 3 | Erro factual/classificação que muda o resultado de um setor |
| 🟡 MÉDIA | 5 | Citação legal errada / inconsistência interna / imprecisão |
| 🟢 OK | — | Itens conferidos e **corretos** (seção 6) |
| ⚪ A confirmar | 6 | Não verificados nesta passada (seção 7) |

**Metodologia:** baixei o texto oficial das duas leis do Planalto e li **artigo por artigo**. Cada achado abaixo cita o artigo da lei e um nível de confiança: `Confirmado` (li no texto primário), `Provável` (indício forte, falta enquadramento fino), `A confirmar`.

---

## 2. 🔴 Achado CRÍTICO

### C1 — Curva de transição 2030/2031/2032 está errada
**Arquivos:** `backend/dados/cronograma.json`; `frontend/app/components/Timeline.tsx`
**O sistema usa:** ICMS/ISS reduzidos em **10% / 25% / 50% / 75%** (fatores 0,90 / 0,75 / 0,50 / 0,25) e IBS a 10% / 25% / 50% / 75%.
**A lei diz (CONFIRMADO):** redução de **10% / 20% / 30% / 40%** (fatores **0,90 / 0,80 / 0,70 / 0,60**), IBS a 10% / 20% / 30% / 40%.
- **LC 214/2025, Art. 501** (insere art. 31‑A na LC 87/96 — ICMS): *"I – 10% em 2029; II – 20% em 2030; III – 30% em 2031; IV – 40% em 2032"*.
- **LC 214/2025, Art. 508** (insere art. 8º‑B na LC 116/03 — ISS): texto idêntico.

**Só 2029 está certo. 2030, 2031 e 2032 estão errados** e contaminam o gráfico de projeção, o comparador e o markup nesses anos. (Curiosamente, o **guia HTML** já traz a curva certa — "20%, 30%, 40%" —, ou seja, o motor contradiz o próprio guia.)

**Cronograma correto (base 28%):**

| Ano | CBS | IBS (atual → correto) | ICMS/ISS fator (atual → correto) |
|---|---|---|---|
| 2029 | 9,3% | 0,0187 (10%) ✓ | 0,90 ✓ |
| 2030 | 9,3% | 0,04675 (25%) → **0,0374 (20%)** | 0,75 → **0,80** |
| 2031 | 9,3% | 0,0935 (50%) → **0,0561 (30%)** | 0,50 → **0,70** |
| 2032 | 9,3% | 0,14025 (75%) → **0,0748 (40%)** | 0,25 → **0,60** |

---

## 3. 🟠 Achados de ALTA gravidade

### A1 — Profissões de SAÚDE com 30% deveriam ter 60%
**Arquivo:** `backend/dados/setores.json` · também no guia HTML (lista de "30%")
**Setores afetados:** `medicina_clinicas`, `odontologia`, `psicologia_terapias`, `nutricao_dietistas` (e provavelmente `farmacia_profissional`) — hoje com `reducao_aliquota: 0.3`.
**A lei (CONFIRMADO):** o rol de **30% é o Art. 127** e é **taxativo** — inclui administradores, advogados, contadores, economistas, engenheiros, **veterinários**, **educação física**, etc., mas **NÃO inclui médicos, dentistas, psicólogos, nutricionistas**. Serviços de saúde têm **redução de 60%** (Art. 128, II + **Art. 130**, Anexo III).
**Efeito:** o sistema **superestima** o imposto desses setores (mostra 30% de desconto quando a lei concede 60%). Confiança: **Alta** (princípio claro; confirmar o enquadramento de cada serviço no Anexo III/NBS).
> `servicos_medicina_veterinaria` e `educacao_fisica_personal` com 30% estão **corretos** (constam no Art. 127).

### A2 — Combustíveis fósseis marcados como sujeitos ao Imposto Seletivo
**Arquivo:** `backend/dados/setores.json` → `combustiveis_fosseis` (`is_aplicavel: true`, `is_estimado: 0.05`)
**A lei (CONFIRMADO):** o IS (**Art. 409, §1º**) incide sobre veículos, embarcações/aeronaves, fumígenos, bebidas alcoólicas, bebidas açucaradas, **bens minerais e carvão mineral**, e prognósticos/*fantasy sport*. **Combustíveis líquidos (gasolina, diesel, GLP) NÃO estão na lista** — têm regime **monofásico** de IBS/CBS (Arts. 172–180), não IS.
**Correção:** `combustiveis_fosseis` não deve ter IS. (tabaco, bebidas alcoólicas e veículos com IS estão **corretos**.)

### A3 — Alíquotas-teste de 2026 erradas no conteúdo do cliente
**Arquivos:** `frontend/public/guia-reforma-tributaria.html` (2 ocorrências) e `frontend/app/components/Timeline.tsx`
**O sistema mostra:** "CBS 0,1% e IBS 0,05%" em 2026.
**A lei (CONFIRMADO):** **CBS 0,9%** (Art. 346) + **IBS 0,1%** (Art. 343) em 2026. O "0,05% + 0,05%" é a alíquota de **2027–2028** (Art. 344) — o guia trocou os anos.
> O `cronograma.json` (0,9% / 0,1%) e o **glossário** ("simbólica 0,9%") já estão **corretos**.

---

## 4. 🟡 Achados de gravidade MÉDIA

### M1 — Citações de artigo erradas nas reduções de 60%
`setores.json` cita "Art. 118" (saúde) e o guia cita "arts. 116–117". **Correto:** rol geral no **Art. 128** e específicos nos **Arts. 129–138** (educação 129, saúde **130**, dispositivos médicos 131, medicamentos 133, alimentos 135, higiene 136, agro in natura 137, insumos agro 138). Os **valores de 60% estão certos** — só a citação está errada. Confiança: Confirmado.

### M2 — `medicamentos_essenciais` cita "Anexo I"
**Correto:** alíquota zero de medicamentos é o **Art. 146 / Anexo XIV**. O Anexo I é o da **cesta básica**. Confiança: Confirmado.

### M3 — `cronograma.json` cita "Art. 350–357" como base
**Correto:** transição nas alíquotas está nos **Arts. 343–347** (alíquotas-teste/transição), **361–365** (referência do IBS) e **501/508** (redução de ICMS/ISS). Confiança: Confirmado.

### M4 — IBS de 2027–2028 está como 0 no cronograma
**Art. 344:** em 2027–2028 o IBS é **0,05% estadual + 0,05% municipal = 0,1%**. O sistema usa `ibs_percentual: 0.0`. Baixa materialidade, mas tecnicamente impreciso. Confiança: Confirmado.

### M5 — Inconsistência interna da alíquota de referência (26,5% × 28%)
Motor e glossário usam **28%** (9,3 + 18,7); o guia HTML usa **26,5%** (8,8 + 17,7) e dele derivam efetivas (saúde "~10,6%", profissões "~18,6%"). **Decisão do escritório: padronizar em 28%.** → ajustar o guia para CBS 9,3% / IBS 18,7% e recomputar: saúde 60% → **11,2%**; profissões 30% → **19,6%**. (Nenhum dos dois é fixado em lei — depende de Resolução do Senado; existe teto legal de 26,5% até 2030.)

---

## 5. Observação sobre a tabela do Simples no guia (a confirmar)
A coluna "IBS aprox. (1ª faixa)" do guia (3,35% / 6,70% / 10,05% / 13,40% em 2029–2032) segue a progressão **20/40/60/80%**, que **não bate** com a transição 10/20/30/40% nem com a coluna ISS ao lado (90/80/70/60). Parece **dobrada**. Confirmar contra os Anexos da LC 123 atualizada pela LC 227. Gravidade: Média.

---

## 6. 🟢 Itens conferidos e CORRETOS (no texto da lei)
- **Restaurantes/bares 40% + crédito vedado** (Arts. 273–276) — já ajustado.
- **Cesta básica: alíquota zero** (Anexo I).
- **Reduções de 60%:** educação, saúde (serviço), agro/insumos, higiene de baixa renda, cultura/esporte, dispositivos médicos — **valores corretos** (Arts. 128–138).
- **30% (Art. 127):** advocacia, contabilidade, engenharia, administração, economia, veterinária, educação física — **corretos**.
- **IS — bens minerais máx. 0,25%** (Art. 422, §2º) e IS **escalonado 2029–2033** sem percentual fixo em lei → o rótulo "estimativa" do sistema (tabaco 150% etc.) é a **abordagem correta**.
- **Medicamentos zero — Art. 146**.
- **Imobiliário:** redutor social de **R$ 600/mês** na locação residencial (Art. 260) e incorporação a **2,08%** (Art. 485).
- **LC 227/2026:** **UPF R$ 200** (Art. 341‑C); saldo credor de ICMS em **240 parcelas**; **ITCMD progressivo**; CGIBS (27+27 representantes).
- **Datas:** CBS plena e fim de PIS/COFINS a partir de 2027; extinção de ICMS/ISS em 2033.

---

## 7. ✅ 2ª passada — VERIFICADA NA LEI (02/06/2026)
1. **Hotelaria/parques 40%** — CONFIRMADO. Regime específico Arts. 277–283; redução de 40% no **Art. 281**; prestador mantém crédito (Art. 282). Citação do guia ajustada (era "art. 280").
2. **Operadoras de planos de saúde 60%** — CONFIRMADO. Redução de 60% de serviços de saúde (Art. 130) + regime específico de apuração dos planos de assistência à saúde. Valor do sistema (60%) adequado.
3. **Financeiro 10,85% → 12,50%** — CONFIRMADO (Art. 233: 2027/28 = 10,85%; 2029 = 11,00%; 2030 = 11,15%; 2031 = 11,30%; 2032 = 11,50%; 2033 = 12,50%).
4. **Parcelamento de solo 3,65%** — CONFIRMADO (Art. 486, §1º).
5. **Multas 75 / 50 / 100 / 150%** — CONFIRMADO (Art. 341‑F: 75% padrão; 50% para declaração correta com erro de cálculo, §3º; 100% fraude/sonegação/conluio; 150% reincidência).
6. **Lei do PIS das operadoras** — OK, NÃO é erro: a Lei 9.715/1998 rege o PIS/PASEP; a citação é defensável. **Salário mínimo 2026 (R$ 1.621)** — item fora da reforma; CONFIRMAR contra o decreto oficial do salário mínimo de 2026 (afeta o cálculo do DAS-MEI).

---

## 8. Status da Fase B — CORREÇÕES APLICADAS (02/06/2026)

Todas as correções abaixo foram aplicadas e validadas no motor de cálculo (processo de teste independente) e confirmadas no servidor ao vivo.

| Achado | Status | Arquivos alterados |
|---|---|---|
| C1 — curva de transição 2030–2032 (90/80/70/60; IBS 10/20/30/40%) | ✅ aplicado | `cronograma.json`, `Timeline.tsx` |
| A1 — saúde 30%→60% (medicina, odontologia, psicologia/terapias, nutrição, farmácia clínica) | ✅ aplicado | `setores.json`, guia HTML |
| A2 — combustíveis fósseis sem Imposto Seletivo | ✅ aplicado | `setores.json` |
| A3 — alíquotas-teste de 2026 (CBS 0,9% + IBS 0,1%) | ✅ aplicado | guia HTML, `Timeline.tsx` |
| M1/M2 — citações de artigo (60% → Arts. 128–138; medicamentos → Art. 146) | ✅ aplicado | `setores.json`, guia HTML |
| M3 — citação da base da transição (Arts. 343–347/361–365/501/508) | ✅ aplicado | `cronograma.json` |
| M4 — IBS 2027–2028 = 0,1% (e CBS −0,1 p.p.) | ✅ aplicado | `cronograma.json` |
| M5 — alíquota de referência padronizada em 28% (efetivas: saúde 11,2%, profissões 19,6%) | ✅ aplicado | guia HTML |

**Validação:** ICMS 2032 a 60% (R$1.080) e IBS 0,0748 confirmados; medicina/odontologia a 60%; combustíveis sem IS; tabaco mantém IS (estimativa). Backend recarregou os JSON automaticamente.

**Para entrar no ar:** apenas atualizar o navegador com `Ctrl+Shift+R` (Timeline e guia HTML). Backend já está com os dados novos.

### Pendências (Seção 7) — não alteradas, aguardam 2ª passada
Os 6 itens "a confirmar" continuam pendentes. Destaque: **`farmacia_profissional`** foi ajustada para 60% como serviço de saúde, mas o enquadramento do "farmacêutico clínico" no Anexo III deve ser confirmado (se não for serviço de saúde, seria alíquota cheia).
