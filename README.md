# Formicarium — Ant Colony Simulator
### Documentação Técnica Completa

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Arquivos](#2-estrutura-de-arquivos)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
4. [Hierarquia de Classes](#4-hierarquia-de-classes)
5. [BIO_CONSTANTS — Parâmetros de Calibração](#5-bio_constants--parâmetros-de-calibração)
6. [Classes de Ciclo de Vida (Brood)](#6-classes-de-ciclo-de-vida-brood)
7. [Classes de Formigas (Ant)](#7-classes-de-formigas-ant)
8. [Sistema de Feromônios](#8-sistema-de-feromônios)
9. [Classes de Comida (FoodItem)](#9-classes-de-comida-fooditem)
10. [Mundo e Terreno](#10-mundo-e-terreno)
11. [Estrutura do Ninho](#11-estrutura-do-ninho)
12. [Predador](#12-predador)
13. [Colony — Orquestração da Colônia](#13-colony--orquestração-da-colônia)
14. [Simulator — Loop Principal](#14-simulator--loop-principal)
15. [Renderer — Renderização Visual](#15-renderer--renderização-visual)
16. [HUD — Interface de Dados](#16-hud--interface-de-dados)
17. [Comportamentos Emergentes](#17-comportamentos-emergentes)
18. [Máquinas de Estado Finito (FSM)](#18-máquinas-de-estado-finito-fsm)
19. [Física e Ambiente](#19-física-e-ambiente)
20. [Como Executar e Modificar](#20-como-executar-e-modificar)

---

## 1. Visão Geral

O **Formicarium** é uma simulação completa de um formigueiro implementada em JavaScript puro, orientada a objetos, sem dependências externas. O sistema modela fielmente a biologia de colônias de formigas reais, incluindo:

- **Metamorfose holometábola** completa (Ovo → Larva → Pupa → Adulto)
- **Comunicação exclusiva por feromônios** (4 tipos funcionais + necromônio)
- **Stigmergy**: comportamento coletivo emergindo apenas de feromônios + ambiente, sem comunicação direta entre formigas
- **Castas com fisiologia distinta**: Operária, Soldado, Rainha
- **Ciclo ambiental**: dia/noite, chuva, vento, temperatura
- **Predadores externos** com resposta de defesa coordenada

A simulação roda a 60fps via `requestAnimationFrame`, separando completamente a lógica de atualização da renderização.

---

## 2. Estrutura de Arquivos

```
formicarium/
├── ant_simulator.js   # Todo o motor da simulação (OOP, lógica, renderização)
└── index.html         # Interface HTML com canvas e painel HUD lateral
```

Ambos os arquivos devem estar no mesmo diretório. Basta abrir `index.html` em um navegador moderno (Chrome, Firefox, Edge).

---

## 3. Arquitetura do Sistema

```
index.html
  └── instancia Simulator(canvas, hudPanel)
        ├── World          — grade de células, terreno, clima
        ├── PheromoneSystem — 5 camadas de feromônio com difusão
        ├── Nest           — câmaras, túneis, entrada, estoque de comida
        ├── Colony         — contém formigas, brood, comida, predadores
        ├── Renderer       — desenha tudo no <canvas>
        └── HUD            — atualiza o painel lateral HTML
```

O `Simulator` é o único ponto de entrada. Ele contém o loop principal (`requestAnimationFrame`) que a cada frame:

1. Acumula tempo decorrido
2. Executa `doTick()` em passos de 1/60s (máximo 3 por frame para evitar espiral)
3. Chama `render()` para desenhar o estado atual

---

## 4. Hierarquia de Classes

```
ColonyMember
├── Egg
├── Larva
├── Pupa
└── Ant
    ├── WorkerAnt
    ├── SoldierAnt
    └── QueenAnt

FoodItem
├── Seed
├── InsectCorpse
├── Honeydew
└── ProteinFragment

WorldCell
World

Chamber
Tunnel
Nest

PheromoneLayer
PheromoneSystem

Predator
Colony
Simulator
Renderer
HUD
```

### Funções Utilitárias Globais

| Função | Descrição |
|---|---|
| `generateId()` | Retorna um ID inteiro único e crescente para cada entidade |
| `dist(a, b)` | Distância euclidiana entre dois pontos `{x, y}` |
| `clamp(v, min, max)` | Limita um valor entre mínimo e máximo |
| `randomRange(a, b)` | Número aleatório no intervalo `[a, b)` |
| `angleToVec(angle)` | Converte ângulo em radians para vetor `{x, y}` unitário |

---

## 5. BIO_CONSTANTS — Parâmetros de Calibração

Objeto global que centraliza todos os parâmetros biológicos e de simulação. Qualquer ajuste de comportamento deve ser feito aqui.

### Feromônios

| Constante | Valor | Descrição |
|---|---|---|
| `PHEROMONE_TRAIL_DECAY` | 0.0035 | Decaimento do rastro de trilha por tick (~0.35%) |
| `PHEROMONE_ALARM_DECAY` | 0.018 | Decaimento do alarme por tick (~1.8%) — muito volátil |
| `PHEROMONE_TERRITORY_DECAY` | 0.001 | Decaimento do territorial por tick (~0.1%) — persistente |
| `PHEROMONE_RECRUIT_DECAY` | 0.009 | Decaimento do recrutamento por tick (~0.9%) |
| `PHEROMONE_DEPOSIT_TRAIL` | 22 | Quantidade depositada de trilha por tick |
| `PHEROMONE_DEPOSIT_ALARM` | 80 | Quantidade depositada de alarme por evento |
| `PHEROMONE_DEPOSIT_RECRUIT` | 45 | Quantidade depositada de recrutamento |
| `PHEROMONE_DEPOSIT_TERRITORY` | 10 | Quantidade depositada de território |
| `PHEROMONE_SENSITIVITY_WORKER` | 0.7 | Multiplicador de sensibilidade da operária |
| `PHEROMONE_SENSITIVITY_SOLDIER` | 0.4 | Multiplicador de sensibilidade do soldado |
| `PHEROMONE_THRESHOLD_FOLLOW` | 4 | Concentração mínima para seguir trilha |

### Rainha

| Constante | Valor | Descrição |
|---|---|---|
| `QUEEN_EGG_INTERVAL_MS` | 3200 | Intervalo de postura em ms (referência; em ticks: ~190) |
| `QUEEN_MAX_EGGS_PER_CYCLE` | 3 | Máximo de ovos por ciclo de postura |
| `QUEEN_LIFESPAN_TICKS` | 999999 | Lifespan praticamente infinito |
| `QUEEN_FOOD_CONSUMPTION` | 0.4 | Energia consumida por tick |

### Ciclo de Vida

| Constante | Valor | Descrição |
|---|---|---|
| `EGG_HATCH_TICKS` | 520 | Ticks até ovo eclodir em larva |
| `LARVAE_PUPATE_TICKS` | 780 | Ticks até larva virar pupa |
| `PUPAE_ECLOSE_TICKS` | 620 | Ticks até pupa eclodir em adulto |
| `LARVAE_FOOD_NEED_PER_TICK` | 0.008 | Comida consumida por larva por tick |
| `ADULT_FOOD_NEED_PER_TICK` | 0.004 | Energia consumida por adulto por tick |
| `WORKER_LIFESPAN_TICKS` | 8500 | Vida útil da operária (~45–60 dias simulados) |
| `SOLDIER_LIFESPAN_TICKS` | 12000 | Vida útil do soldado (~1–2 anos simulados) |

### Atributos das Castas

| Constante | Valor | Descrição |
|---|---|---|
| `WORKER_CARRY_CAPACITY` | 3 | Carga máxima (3× peso corporal) |
| `SOLDIER_CARRY_CAPACITY` | 1 | Carga máxima do soldado |
| `WORKER_SPEED` | 1.45 | Velocidade base da operária (unidades/tick) |
| `SOLDIER_SPEED` | 1.1 | Velocidade base do soldado |
| `QUEEN_SPEED` | 0.3 | Velocidade da rainha |
| `WORKER_VISION_RADIUS` | 55 | Raio de visão da operária (px) |
| `SOLDIER_VISION_RADIUS` | 70 | Raio de visão do soldado (px) |

### Comportamentos Sociais

| Constante | Valor | Descrição |
|---|---|---|
| `ALARM_RADIUS` | 90 | Raio de propagação de alarme |
| `TROPHALLAXIS_RADIUS` | 8 | Raio para transferência de comida boca-a-boca |
| `TANDEM_RUN_RADIUS` | 12 | Raio para tandem running (guia até comida) |
| `COLLABORATIVE_CARRY_MIN_ANTS` | 3 | Mínimo de formigas para carregar InsectCorpse |
| `BRIDGE_GAP_THRESHOLD` | 25 | Distância que ativa estado de ponte corporal |
| `GROOM_DURATION_TICKS` | 30 | Duração do estado de higiene social |
| `LOOPING_DETECTION_TICKS` | 80 | Janela de ticks para detectar loops de movimento |
| `CALLOW_DURATION_TICKS` | 80 | Duração da fase teneral (adulto recém-eclodido) |
| `CALLOW_SPEED_FACTOR` | 0.3 | Velocidade na fase callow (30% da normal) |
| `CALLOW_PHEROMONE_SENSITIVITY_START` | 0.3 | Sensibilidade inicial a feromônios na fase callow |

### Ambiente

| Constante | Valor | Descrição |
|---|---|---|
| `DAY_CYCLE_TICKS` | 10000 | Ticks por dia simulado |
| `AMBIENT_TEMP_DAY` | 28 | Temperatura máxima diurna (°C) |
| `AMBIENT_TEMP_NIGHT` | 18 | Temperatura mínima noturna (°C) |
| `RAIN_PHEROMONE_DILUTION_FACTOR` | 5 | Multiplicador de decaimento de feromônio sob chuva |
| `WIND_PHEROMONE_DRIFT` | 0.4 | Amplitude do vetor de vento |
| `FOOD_HONEYDEW_REGEN_RATE` | 0.5 | Regeneração de honeydew por tick |
| `FOOD_DECAY_RATE_BASE` | 0.001 | Taxa de decaimento base de alimentos |
| `NECROMONE_EMISSION_TICKS` | 300 | Ticks que um cadáver emite necromônio |

### Predadores e Colônia

| Constante | Valor | Descrição |
|---|---|---|
| `PREDATOR_APPEAR_INTERVAL_TICKS` | 5000 | Intervalo entre aparições de predadores |
| `PREDATOR_EAT_RADIUS` | 20 | Raio de alcance do predador |
| `COLONY_STARVATION_DEATH_TICKS` | 200 | Ticks em inanição antes da colônia morrer |
| `POPULATION_START_WORKERS` | 40 | Operárias iniciais |
| `POPULATION_START_SOLDIERS` | 8 | Soldados iniciais |
| `FOOD_ITEMS_START` | 18 | Itens de comida no início |
| `BROOD_TEMP_MIN` | 20 | Temperatura mínima para desenvolvimento de ovos |
| `BROOD_TEMP_MAX` | 34 | Temperatura máxima para desenvolvimento de ovos |
| `WORKER_CASTE_PROBABILITY` | 0.85 | Probabilidade de casta operária (85%) |
| `SOLDIER_CASTE_PROBABILITY` | 0.13 | Probabilidade de casta soldado (13%) |
| `QUEEN_CASTE_PROBABILITY` | 0.02 | Probabilidade de casta rainha alada (2%) |

---

## 6. Classes de Ciclo de Vida (Brood)

### `ColonyMember` (base)

Classe raiz para todas as entidades da colônia.

| Propriedade | Tipo | Descrição |
|---|---|---|
| `id` | `number` | ID único global gerado por `generateId()` |
| `position` | `{x, y}` | Posição no canvas |
| `alive` | `boolean` | Se a entidade ainda está viva/ativa |
| `age` | `number` | Ticks de vida acumulados |

Método `tick()` incrementa `age`.

---

### `Egg extends ColonyMember`

Representa um ovo. Sem mobilidade, posicionado nas brood chambers.

| Propriedade | Valor padrão | Descrição |
|---|---|---|
| `ticksLeft` | 520 | Ticks restantes até eclodir |
| `requiresTemp` | `true` | Precisa de temperatura adequada para progredir |

**`tick(ambientTemp)`**: Decrementa `ticksLeft` apenas se `ambientTemp` estiver entre `BROOD_TEMP_MIN` e `BROOD_TEMP_MAX`. Ao zerar, retorna uma nova instância de `Larva` e seta `alive = false`.

---

### `Larva extends ColonyMember`

Representa uma larva em crescimento.

| Propriedade | Descrição |
|---|---|
| `ticksLeft` | Ticks restantes até pupar (começa em 780) |
| `fedDelay` | Contador de ticks sem alimentação (morre se > 50) |
| `radius` | Raio visual — cresce de 2 a 5px conforme `ticksLeft` diminui |
| `foodPheromone` | Intensidade constante de feromônio de alimentação emitido |

**`tick(foodAvailable)`**: Recebe `1` se há comida no ninho, `0` caso contrário. Incrementa `fedDelay` sem comida. Retorna nova `Pupa` ao completar, `null` se morreu de fome.

---

### `Pupa extends ColonyMember`

Representa a fase de pupa. A casta é determinada aqui.

| Propriedade | Descrição |
|---|---|
| `ticksLeft` | Ticks restantes até eclosão (começa em 620) |
| `caste` | `'worker'` (85%), `'soldier'` (13%) ou `'queen'` (2%) |

**`tick(queenPresent)`**: Se `queenPresent === true` e `caste === 'queen'`, a casta é forçada para `'worker'` (supressão pela queen substance). Ao completar, retorna a string da casta para o `Simulator` spawnar o adulto correspondente.

---

## 7. Classes de Formigas (Ant)

### `Ant extends ColonyMember` (base adulto)

| Propriedade | Tipo | Descrição |
|---|---|---|
| `caste` | `string` | `'worker'`, `'soldier'` ou `'queen'` |
| `energy` | `number` | Energia atual (0–100); morte se chegar a 0 |
| `maxEnergy` | `number` | Energia máxima (100) |
| `carrying` | `string\|null` | Tipo de comida sendo carregada |
| `carryAmount` | `number` | Quantidade carregada |
| `state` | `string` | Estado atual da FSM |
| `angle` | `number` | Direção de movimento em radianos |
| `pheromoneMemory` | `array` | Cache de detecções de feromônio (limpo se loop detectado) |
| `lifespan` | `number` | Ticks máximos de vida |
| `callowTicks` | `number` | Ticks restantes na fase teneral |
| `pheromoneSensitivity` | `number` | Multiplicador de sensibilidade 0.3 → 1.0 durante callow |
| `legPhase` | `number` | Fase da oscilação senoidal das pernas (animação) |
| `antennaAngle` | `number` | Ângulo das antenas (reage a feromônios) |
| `isDead` | `boolean` | `true` quando morreu (emite necromônio) |
| `parasites` | `number` | Contador de parasitas (reduzido pelo grooming) |

**Métodos principais:**

| Método | Descrição |
|---|---|
| `get speed()` | Propriedade abstrata sobrescrita pelas subclasses |
| `get effectiveSpeed()` | Aplica `CALLOW_SPEED_FACTOR` se ainda em fase teneral |
| `consumeEnergy(amount)` | Reduz energia; chama `die()` se ≤ 0 |
| `die()` | Seta `isDead = true`, `alive = false` |
| `receiveFeed(amount)` | Aumenta energia até `maxEnergy` |
| `updateCallow()` | Decrementa `callowTicks` e interpola `pheromoneSensitivity` |
| `samplePheromone(sys, type)` | Amostra 3 pontos à frente (centro, esquerda 45°, direita 45°) |
| `moveWithGradient(sys, type, world)` | Move seguindo gradiente de feromônio + ruído de 15% |
| `moveForward(world)` | Avança na direção de `angle`; reflexiona se bloqueado |
| `checkLooping()` | Detecta circulação; reseta memória se posição inicial ≈ final |

---

### `WorkerAnt extends Ant`

A casta mais numerosa. Responsável por coleta, alimentação de larvas, higiene e construção.

**Velocidade**: 1.45 unidades/tick  
**Capacidade de carga**: 3 unidades  
**Lifespan**: 8500 ticks

#### FSM — Estados da Operária

| Estado | Trigger | Comportamento |
|---|---|---|
| `EXPLORE` | Estado padrão | Caminhada exploratória com ruído angular; detecta trilhas e comida |
| `FOLLOW_TRAIL` | Feromônio trail ou recruit > threshold | Segue gradiente de feromônio até encontrar comida ou voltar ao ninho |
| `COLLECT` | Comida visível no raio de visão | Move até o alimento e carrega |
| `RETURN_HOME` | Com comida carregada | Deposita trilha enquanto volta; entrega comida ao ninho |
| `FEED_LARVAE` | Larvas presentes + comida no ninho | Vai até larva e a alimenta |
| `FLEE` | Feromônio de alarme > 20 | Corre em direção ao ninho depositando alarme |
| `GROOM` | Probabilidade 0.5%/tick | Para e reduz parasitas próprios e de formigas próximas |
| `BRIDGE` | Detecta lacuna (gap > 25px) | Fica estacionária depositando trilha para outras atravessarem |

**Métodos:**

| Método | Descrição |
|---|---|
| `doExplore()` | Exploração aleatória com detecção de trilhas e comida |
| `doFollowTrail()` | Segue gradiente de trail/recruit pheromone |
| `doCollect()` | Coleta SEED, INSECT_CORPSE, PROTEIN_FRAGMENT ou bebe HONEYDEW in situ |
| `doReturnHome()` | Depósito de trilha + entrega de carga ao ninho |
| `doFeedLarvae()` | Encontra larva mais próxima e transfere comida |
| `doFlee()` | Fuga para o ninho com deposição de alarme |
| `doGroom()` | Grooming social; reduz `parasites` próprios e de vizinhos |
| `doBridge()` | Estado de ponte corporal — fica parada depositando trilha |
| `doTrophallaxis()` | Se com energia > 70 e carregando comida, alimenta operárias com energia < 40 em raio de 8px |

---

### `SoldierAnt extends Ant`

Defesa da colônia. Cabeça e mandíbulas maiores, raio de combate 1.8× maior.

**Velocidade**: 1.1 unidades/tick  
**Lifespan**: 12000 ticks  
**Raio de combate**: 18 × 1.8 = 32.4 px

#### FSM — Estados do Soldado

| Estado | Trigger | Comportamento |
|---|---|---|
| `PATROL` | Estado padrão | Patrulha em raio de 80px ao redor da entrada do ninho |
| `GUARD_ENTRANCE` | Probabilidade aleatória | Posiciona-se na entrada do ninho |
| `ATTACK` | Predador no raio de combate | Persegue e danifica predador; deposita alarme |
| `RESPOND_ALARM` | Feromônio de alarme > threshold×3 | Corre em direção à maior concentração de alarme |
| `ESCORT` | — | Retorna ao ninho escoltando outras formigas |

---

### `QueenAnt extends Ant`

Única reprodutora da colônia. Permanece na câmara real.

**Velocidade**: 0.3 unidades/tick  
**Lifespan**: 999999 ticks (praticamente imortal)  
**Consumo**: 0.4 energia/tick

**Comportamento de postura:**
- A cada `~190 ticks`, deposita de 1 a `min(3, floor(foodStorage/50))` ovos
- Ovos são posicionados aleatoriamente dentro da câmara real
- Se `energy < 20` e `foodStorage > 1`, consome 1 unidade de comida e recupera 20 de energia

**Queen substance:** A presença da rainha (`colony.queenPresent = true`) bloqueia o desenvolvimento de castas rainha nas pupas (ver `Pupa.tick()`).

---

## 8. Sistema de Feromônios

### `PheromoneLayer`

Camada individual de feromônio implementada como `Float32Array` (grid 2D flattened).

| Propriedade | Descrição |
|---|---|
| `cellSize` | Tamanho de cada célula em px (padrão: 8) |
| `cols`, `rows` | Dimensões do grid |
| `data` | `Float32Array` com concentrações (0–255) |
| `decayRate` | Taxa de decaimento por tick |

| Método | Descrição |
|---|---|
| `get(x, y)` | Retorna concentração na posição de mundo (x, y) |
| `deposit(x, y, amount)` | Adiciona `amount` à célula correspondente (max 255) |
| `decay(rainFactor)` | Multiplica todo o grid por `(1 - decayRate * rainFactor)` |
| `diffuse()` | Difusão lateral: cada célula troca 5% com a média dos vizinhos |

### `PheromoneSystem`

Contém 5 camadas de feromônio:

| Camada | Cor visual | Papel biológico |
|---|---|---|
| `trail` | Âmbar/amarelo | Rastro de coleta — guia operárias até comida e de volta ao ninho |
| `alarm` | Vermelho | Alerta de perigo — fuga de operárias, recrutamento de soldados |
| `territory` | Azul suave | Marcação de território — formigas de outras colônias disparariam alarme |
| `recruit` | Laranja | Recrutamento em massa para fonte de comida abundante |
| `necromone` | Roxo | Emitido por cadáveres — recruta operárias para necróforos |

**`tick(isRaining)`**: Chama `decay()` e `diffuse()` em todas as camadas. Se `isRaining`, o fator de decaimento é multiplicado por `RAIN_PHEROMONE_DILUTION_FACTOR = 5`.

---

## 9. Classes de Comida (FoodItem)

### `FoodItem` (base)

| Propriedade | Descrição |
|---|---|
| `type` | String identificadora do tipo |
| `quantity` | Quantidade disponível; objeto removido ao zerar |
| `decayRate` | Taxa de decaimento por tick |
| `nutritionalValue` | Multiplicador de valor nutricional |

**`tick()`**: Reduz `quantity` por `decayRate`. Seta `alive = false` quando `quantity ≤ 0`.

---

### `Seed extends FoodItem`

- **Quantidade inicial**: 5–15 unidades
- **Densidade**: 1.0 — fácil transporte por uma operária sozinha
- **Valor nutricional**: 0.8

---

### `InsectCorpse extends FoodItem`

- **Quantidade inicial**: 10–30 unidades
- **Densidade**: 3.0 — requer transporte colaborativo
- **Valor nutricional**: 1.5
- **`collaborativeCarry(ants)`**: Conta operárias em raio de 20px. Retorna `true` se ≥ `COLLABORATIVE_CARRY_MIN_ANTS = 3`.

---

### `Honeydew extends FoodItem`

- **Quantidade inicial**: 20–50 unidades
- **`decayRate`**: 0 — não decai naturalmente
- **Regeneração**: +0.5 unidades/tick se `harvestCount < maxHarvest`
- **Comportamento**: Formigas consomem *in situ* (não carregam); voltam ao ninho com "papo cheio" (`carrying = 'HONEYDEW'`). Simula cultivo de pulgões.

---

### `ProteinFragment extends FoodItem`

- **Quantidade inicial**: 3–8 unidades
- **Valor nutricional**: 2.0 — alta prioridade para larvas
- **`priority`**: `'HIGH'`

---

## 10. Mundo e Terreno

### `WorldCell`

Célula individual do grid do mundo.

| Propriedade | Descrição |
|---|---|
| `type` | `'SURFACE'`, `'SOIL'`, `'ROCK'`, `'WATER'`, `'TUNNEL'`, `'CHAMBER'` |
| `blocked` | `true` para `ROCK` e `WATER` — bloqueia movimento e difusão |
| `temperature` | Temperatura local da célula |

---

### `World`

Grid completo do mundo simulado.

**Construção do terreno** (em `initCells()`):
- Linha `rows × 0.38` divide superfície (`SURFACE`) de subsolo (`SOIL`)
- 6 obstáculos aleatórios de tipo `ROCK` ou `WATER` são inseridos
- Obstáculos têm 2×2 células

| Propriedade | Descrição |
|---|---|
| `windVector` | `{x, y}` — vetor de vento que oscila por função senoidal |
| `isRaining` | `boolean` — ativa quando ciclo de chuva dispara |
| `rainTimer` | Contador para ciclos de chuva |

**Métodos:**

| Método | Descrição |
|---|---|
| `getCell(x, y)` | Retorna `WorldCell` na posição de mundo |
| `isBlocked(x, y)` | `true` se fora dos limites ou célula bloqueada |
| `isSurface(x, y)` | `true` se a célula é do tipo `SURFACE` |
| `updateTemperatures(ambientTemp)` | Atualiza temperatura de cada célula conforme tipo |
| `tick(tick)` | Atualiza vento e ciclo de chuva |

---

## 11. Estrutura do Ninho

### `Chamber`

Câmara oval dentro do ninho.

| Propriedade | Descrição |
|---|---|
| `x, y, width, height` | Posição e dimensões |
| `type` | `'QUEEN_CHAMBER'`, `'BROOD_CHAMBER'`, `'FOOD_STORAGE'`, `'WASTE_CHAMBER'`, `'WORKER_DORMITORY'` |
| `center` | `{x, y}` — centro calculado automaticamente |

---

### `Tunnel`

Corredor entre câmaras.

| Propriedade | Descrição |
|---|---|
| `x1, y1, x2, y2` | Pontos inicial e final |
| `width` | Largura do túnel em px (5–8) |
| `length` | Comprimento calculado automaticamente |

---

### `Nest`

O ninho completo, construído a partir de um ponto de entrada.

**Câmaras criadas automaticamente:**

| Câmara | Quantidade | Função |
|---|---|---|
| `QUEEN_CHAMBER` | 1 | Câmara da rainha + postura de ovos |
| `BROOD_CHAMBER` | 2 | Armazenamento de brood (ovos, larvas, pupas) |
| `FOOD_STORAGE` | 2 | Estoque de alimentos |
| `WASTE_CHAMBER` | 1 | Descarte de resíduos e cadáveres |
| `WORKER_DORMITORY` | 1 | Dormitório das operárias |

**Propriedades importantes:**

| Propriedade | Descrição |
|---|---|
| `entrance` | `{x, y}` — entrada principal na superfície |
| `emergencyExits` | Array de 2 saídas de emergência ativadas quando `alarmLevel > 40` |
| `foodStorage` | Estoque de comida da colônia (inicia em 150) |
| `starvationTimer` | Ticks com `foodStorage = 0`; colônia morre em 200 |

---

## 12. Predador

### `Predator`

Entidade hostil que aparece periodicamente na superfície.

| Propriedade | Valor | Descrição |
|---|---|---|
| `health` | 50 | Pontos de vida |
| `speed` | 0.8 | Velocidade de movimento |
| `eatTimer` | 0 | Cooldown de 30 ticks entre consumos |

**Comportamento:**
- Move com caminhada browniana (ângulo aleatório)
- A cada 30 ticks, consome a formiga mais próxima em raio `PREDATOR_EAT_RADIUS = 20px`
- Ao consumir, deposita `PHEROMONE_DEPOSIT_ALARM = 80` de alarme
- Soldados atacam causando 2 de dano por tick
- Desaparece ao sair dos limites ou ao morrer (`health ≤ 0`)
- Um novo predador aparece a cada `PREDATOR_APPEAR_INTERVAL_TICKS = 5000` ticks

---

## 13. Colony — Orquestração da Colônia

Contém todas as entidades e serve como "banco de dados" vivo da simulação.

| Propriedade | Descrição |
|---|---|
| `ants` | Array de todos os adultos vivos |
| `brood` | Array de Eggs, Larvae e Pupae vivos |
| `foodItems` | Array de itens de comida no mundo |
| `predators` | Array de predadores ativos |
| `queen` | Referência à instância de `QueenAnt` |
| `queenPresent` | `boolean` — flag de queen substance para Pupas |
| `deadAnts` | Array de partículas visuais de formigas mortas recentes |

---

## 14. Simulator — Loop Principal

O `Simulator` instancia e coordena todos os subsistemas.

### Inicialização (`init()`)

1. Cria rainha na `queenChamber`
2. Distribui 40 operárias em raio aleatório ao redor da entrada
3. Distribui 8 soldados próximos à entrada
4. Chama `spawnFood()` para criar os 18 itens iniciais
5. Insere 8 ovos em cada brood chamber

### Loop (`loop(time)`)

```
requestAnimationFrame → loop(time)
  ├── Calcula dt desde último frame
  ├── Acumula em accum
  ├── Enquanto accum >= 1/60s e steps < 3:
  │     doTick()
  │     accum -= 1/60s
  └── render()
```

### `doTick()`

Executa um tick lógico completo na seguinte ordem:

1. Incrementa `this.tick`
2. Atualiza temperatura ambiente (ciclo senoidal dia/noite)
3. `world.tick()` — vento, chuva
4. `world.updateTemperatures()` — distribui temperatura por tipo de célula
5. Tick de cada formiga viva
6. Tick de cada membro do brood (com progressão de metamorfose)
7. Desconta comida consumida por larvas do `nest.foodStorage`
8. Spawna novos adultos quando pupas eclodem
9. Tick de cada item de comida (decaimento)
10. Remove comida morta; 0.2% de chance de spawnar nova comida
11. Spawn de predador se `predatorTimer >= 5000`
12. Tick de cada predador
13. Remove formigas mortas; registra necromônio e alarme para mortos
14. Limpa `deadAnts` antigas
15. Atualiza saídas de emergência via `nest.tick(alarmLevel)`
16. `pheromoneSystem.tick()` — decaimento + difusão de todas as camadas
17. Verifica inanição da colônia

---

## 15. Renderer — Renderização Visual

Separado completamente da lógica. Usa dois canvas: o principal e um canvas off-screen para feromônios.

### Camadas de renderização (em ordem)

1. **Background** — gradiente de superfície verde + solo estratificado marrom + obstáculos
2. **Pheromones** — canvas off-screen com células coloridas semitransparentes, fundido com `globalAlpha = 0.65`
3. **Nest** — túneis como linhas grossas, câmaras como elipses com gradiente radial
4. **Brood** — ovos (elipses brancas), larvas (círculos pulsantes), pupas (elipses bege)
5. **Food** — ícones distintos por tipo com `globalAlpha` proporcional à quantidade
6. **Predators** — silhuetas vermelhas com raio de alcance
7. **Ants** — desenhadas individualmente com anatomia completa
8. **Dead ants** — elipses marrons que desvanecem
9. **Rain** — traços diagonais azuis semitransparentes

### Anatomia visual das formigas (`drawAnt`)

Cada formiga é desenhada com:
- **6 pernas** com oscilação senoidal (`Math.sin(legPhase)`) com fase alternada por lado e posição
- **Gáster** (oval maior)
- **Tórax** (oval médio)
- **Cabeça** (círculo; soldados têm cabeça 1.4× mais larga)
- **2 antenas** segmentadas com curva quadrática, oscilando com `antennaAngle`
- **Carga** visual acima da cabeça (cor varia por tipo de comida)
- **Aura dourada** para a rainha (pulsante)
- **Escala**: Rainha 1.7×, Soldado 1.3×, Operária 1.0×

### Cores por casta

| Casta | Fase callow | Fase adulta |
|---|---|---|
| Operária | Tons bege claro | Tons marrom escuro |
| Soldado | — | Quase preto com tórax muito escuro |
| Rainha | — | Dourado/âmbar com aura |

---

## 16. HUD — Interface de Dados

Atualiza o painel lateral HTML a cada frame com dados em tempo real.

**Seções exibidas:**

| Seção | Dados |
|---|---|
| Colony Status | Dia simulado, hora do dia (0–24h), tick total, temperatura, indicador de chuva |
| Population | Contagem de operárias, soldados, status da rainha, energia da rainha |
| Brood | Contagem de ovos, larvas, pupas |
| Resources | Estoque de comida com barra de progresso; alerta de inanição se ativo |
| Threats | Predadores ativos, formigas mortas recentes |
| Legend | Legenda de cores dos feromônios |

---

## 17. Comportamentos Emergentes

### Stigmergy
Nenhuma formiga sabe onde está a comida globalmente. O comportamento coletivo emerge de:
1. Operária encontra comida por exploração aleatória
2. Ao retornar, deposita `trail pheromone`
3. Outras operárias detectam o gradiente e seguem a trilha
4. Trilhas bem-sucedidas são reforçadas; trilhas sem comida dissipam
5. Auto-organização emergente sem coordenação central

### Trophallaxis
Transferência boca-a-boca de comida entre operárias:
- Operária com energia > 70 e carregando alimento
- Encontra operária com energia < 40 a menos de 8px
- Transfere até 10 unidades de carga → aumenta energia da colega
- Distribui recursos pela colônia sem armazenamento centralizado forçado

### Necrophoresis
Higiene coletiva com cadáveres:
- Formiga morta emite `necromone` por 300 ticks
- `necromone` dispara também `alarm pheromone` moderado
- Operárias detectam e carregam o cadáver para a waste chamber
- Previne propagação de patógenos (modelada como remoção de cadáver)

### Grooming Social
- 0.5% de chance por tick de entrar em estado `GROOM`
- Dura 30 ticks; reduz `parasites` próprios e de formigas vizinhas
- Máximo de 3 operárias simultaneamente em grooming

### Looping Prevention
- Cada formiga mantém histórico das últimas 80 posições
- Se a posição inicial ≈ posição final (raio < 15px): loop detectado
- Reação: limpar `pheromoneMemory`, ângulo aleatório, reiniciar histórico
- Previne formigas "presas" em órbitas circulares

### Fase Callow (Teneral)
- Adultos recém-eclodidos têm velocidade reduzida a 30% por 80 ticks
- Sensibilidade a feromônios cresce gradualmente de 0.3 para 1.0
- Simula endurecimento da cutícula e aprendizado de trilhas

### Resposta Coletiva a Predadores
- Predador deposita alarme continuamente
- Operárias próximas: `state → FLEE` (fuga ao ninho)
- Soldados: `state → RESPOND_ALARM` → localizam predador → `ATTACK`
- Múltiplos soldados atacam simultaneamente (2 dano/tick cada)
- Alarm pheromone propaga a reação em cascata

---

## 18. Máquinas de Estado Finito (FSM)

### Operária — Diagrama de Transições

```
                    ┌──────────────────────────────┐
                    │           EXPLORE             │◄───────────────────────────┐
                    └──────────────────────────────┘                             │
                           │              │                                       │
                    feromônio>threshold   comida no raio                         │
                           │              │                                       │
                           ▼              ▼                                       │
                    FOLLOW_TRAIL       COLLECT                                    │
                           │              │                                       │
                    encontra comida    com carga                                  │
                           │              │                                       │
                           └──────►  RETURN_HOME ──► larvas + comida ──► FEED_LARVAE ─┘
                                         │
                                    a cada ciclo
                                         │
                              ┌─────────►▼◄─────────┐
                              │          │            │
                       alarm>20       lacuna        0.5%
                              │          │            │
                              ▼          ▼            ▼
                            FLEE      BRIDGE        GROOM
                              │                       │
                           ninho<30               30 ticks
                              │                       │
                              └───────────────────────┘
                                         │
                                     EXPLORE
```

### Soldado — Diagrama de Transições

```
          ┌─────────► PATROL ◄──────────────────────────────┐
          │               │                                   │
     sem alarme      predador no raio                 sem predador
          │               │                                   │
          │               ▼                                   │
          │            ATTACK ──── predador morto ────────────┘
          │
     alarm<threshold                 alarm>threshold×3
          │                                │
     GUARD_ENTRANCE ◄────── RESPOND_ALARM ─┘
          │
     0.2%/tick
          │
       PATROL
```

---

## 19. Física e Ambiente

### Ciclo Dia/Noite

A temperatura ambiente oscila senoidalmente:

```
ambientTemp = NIGHT + (DAY - NIGHT) × (sin(phase × 2π - π/2) × 0.5 + 0.5)
```

onde `phase = (tick % 10000) / 10000`.

- **Tick 0**: temperatura mínima (noite)
- **Tick 2500**: temperatura subindo (manhã)
- **Tick 5000**: temperatura máxima (meio-dia)
- **Tick 7500**: temperatura descendo (tarde)

### Chuva

- Ciclo aleatório: após 8000 ticks sem chuva, 0.01% de chance por tick de alternar
- Efeitos: feromônios na superfície decaem 5× mais rápido
- Visual: traços diagonais azuis semitransparentes
- Comportamento: operárias retornam ao ninho durante chuva intensa (via detecção de alarme aumentado)

### Vento

```javascript
windVector.x = cos(tick × 0.0001) × WIND_PHEROMONE_DRIFT × 0.5
windVector.y = sin(tick × 0.00007) × WIND_PHEROMONE_DRIFT × 0.2
```

O vento oscila suavemente com frequências diferentes em X e Y, criando padrão de deriva não-periódico.

### Temperatura das Células

| Tipo de célula | Temperatura |
|---|---|
| `SURFACE` | `ambientTemp` exata |
| `WATER` | `ambientTemp × 0.85` |
| `SOIL`, `TUNNEL`, `CHAMBER` | `ambientTemp - 2 + ruído(0, 0.5)` |

### Desenvolvimento de Brood com Temperatura

Ovos só progridem em desenvolvimento se:
```
20°C ≤ ambientTemp ≤ 34°C
```

Fora desta faixa, o contador `ticksLeft` do ovo não avança.

---

## 20. Como Executar e Modificar

### Execução

1. Coloque `ant_simulator.js` e `index.html` no mesmo diretório
2. Abra `index.html` em qualquer navegador moderno
3. Não é necessário servidor — funciona via `file://`

### Controles

| Controle | Ação |
|---|---|
| Scroll do mouse | Zoom in/out (0.5× a 3×) |
| Botão Pause/Resume | Pausa o loop de simulação |
| Botão Restart | Recarrega a página reiniciando tudo |

### Ajuste de Parâmetros

Para modificar qualquer aspecto da simulação, edite `BIO_CONSTANTS` no topo de `ant_simulator.js`:

```javascript
// Exemplo: tornar a simulação mais agitada
BIO_CONSTANTS.PHEROMONE_ALARM_DECAY = 0.005;  // alarme dura mais
BIO_CONSTANTS.PREDATOR_APPEAR_INTERVAL_TICKS = 2000;  // predadores mais frequentes
BIO_CONSTANTS.POPULATION_START_WORKERS = 80;  // mais operárias iniciais
```

### Extensão — Adicionando um Novo Tipo de Comida

```javascript
class Mushroom extends FoodItem {
  constructor(x, y) {
    super(x, y, 'MUSHROOM', randomRange(8, 20));
    this.nutritionalValue = 1.8;
    this.decayRate = 0.0005;  // apodrece lentamente
  }
}
```

Em seguida, adicione `'MUSHROOM'` ao array de tipos em `spawnSingleFood()` e `spawnFood()`, e adicione a renderização em `Renderer.drawFoodItems()`.

### Extensão — Adicionando um Novo Estado à Operária

1. Adicione a string do estado à FSM em `doExplore()` ou outro estado de entrada
2. Crie o método `doNovoEstado(world, pheromoneSystem, nest, colony)`
3. Adicione o `case` correspondente no `switch` dentro de `WorkerAnt.tick()`

---

## Notas de Performance

- O sistema usa `Float32Array` para as camadas de feromônio — significativamente mais eficiente que arrays de objetos
- O canvas de feromônios é off-screen e só é copiado ao canvas principal com `globalAlpha = 0.65`
- O loop limita a 3 ticks por frame para evitar spiral of death em abas em background
- Com 50+ formigas, o custo dominante é a difusão de feromônios (O(cols × rows) por camada por tick)
- Para otimização adicional: reduzir `cellSize` de 8 para 12+ reduz o grid e melhora performance

---

*Documentação gerada para Formicarium v1.0 — 1734 linhas de JavaScript puro, sem dependências externas.*
