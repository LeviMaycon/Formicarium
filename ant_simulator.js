const BIO_CONSTANTS = {
    PHEROMONE_TRAIL_DECAY: 0.0035,
    PHEROMONE_ALARM_DECAY: 0.018,
    PHEROMONE_TERRITORY_DECAY: 0.001,
    PHEROMONE_RECRUIT_DECAY: 0.009,
    PHEROMONE_DEPOSIT_TRAIL: 22,
    PHEROMONE_DEPOSIT_ALARM: 80,
    PHEROMONE_DEPOSIT_RECRUIT: 45,
    PHEROMONE_DEPOSIT_TERRITORY: 10,
    PHEROMONE_SENSITIVITY_WORKER: 0.7,
    PHEROMONE_SENSITIVITY_SOLDIER: 0.4,
    PHEROMONE_THRESHOLD_FOLLOW: 4,
    QUEEN_EGG_INTERVAL_MS: 3200,
    QUEEN_MAX_EGGS_PER_CYCLE: 3,
    QUEEN_LIFESPAN_TICKS: 999999,
    QUEEN_FOOD_CONSUMPTION: 0.4,
    EGG_HATCH_TICKS: 520,
    LARVAE_PUPATE_TICKS: 780,
    PUPAE_ECLOSE_TICKS: 620,
    LARVAE_FOOD_NEED_PER_TICK: 0.008,
    ADULT_FOOD_NEED_PER_TICK: 0.004,
    WORKER_LIFESPAN_TICKS: 8500,
    SOLDIER_LIFESPAN_TICKS: 12000,
    WORKER_CARRY_CAPACITY: 3,
    SOLDIER_CARRY_CAPACITY: 1,
    WORKER_SPEED: 1.45,
    SOLDIER_SPEED: 1.1,
    QUEEN_SPEED: 0.3,
    WORKER_VISION_RADIUS: 55,
    SOLDIER_VISION_RADIUS: 70,
    ALARM_RADIUS: 90,
    TROPHALLAXIS_RADIUS: 8,
    TANDEM_RUN_RADIUS: 12,
    COLLABORATIVE_CARRY_MIN_ANTS: 3,
    BRIDGE_GAP_THRESHOLD: 25,
    GROOM_DURATION_TICKS: 30,
    LOOPING_DETECTION_TICKS: 80,
    CALLOW_DURATION_TICKS: 80,
    CALLOW_SPEED_FACTOR: 0.3,
    CALLOW_PHEROMONE_SENSITIVITY_START: 0.3,
    DAY_CYCLE_TICKS: 10000,
    AMBIENT_TEMP_DAY: 28,
    AMBIENT_TEMP_NIGHT: 18,
    RAIN_PHEROMONE_DILUTION_FACTOR: 5,
    WIND_PHEROMONE_DRIFT: 0.4,
    FOOD_HONEYDEW_REGEN_RATE: 0.5,
    FOOD_DECAY_RATE_BASE: 0.001,
    NECROMONE_EMISSION_TICKS: 300,
    PREDATOR_APPEAR_INTERVAL_TICKS: 5000,
    PREDATOR_EAT_RADIUS: 20,
    COLONY_STARVATION_DEATH_TICKS: 200,
    POPULATION_START_WORKERS: 40,
    POPULATION_START_SOLDIERS: 8,
    FOOD_ITEMS_START: 18,
    BROOD_TEMP_MIN: 20,
    BROOD_TEMP_MAX: 34,
    WORKER_CASTE_PROBABILITY: 0.85,
    SOLDIER_CASTE_PROBABILITY: 0.13,
    QUEEN_CASTE_PROBABILITY: 0.02
};

let _nextId = 0;
function generateId() { return ++_nextId; }

function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

function randomRange(a, b) { return a + Math.random() * (b - a); }

function angleToVec(angle) { return { x: Math.cos(angle), y: Math.sin(angle) }; }

class ColonyMember {
    constructor(x, y) {
        this.id = generateId();
        this.position = { x, y };
        this.alive = true;
        this.age = 0;
    }
    tick() { this.age++; }
}

class Egg extends ColonyMember {
    constructor(x, y) {
        super(x, y);
        this.ticksLeft = BIO_CONSTANTS.EGG_HATCH_TICKS;
        this.requiresTemp = true;
    }

    tick(ambientTemp) {
        super.tick();
        if (ambientTemp >= BIO_CONSTANTS.BROOD_TEMP_MIN && ambientTemp <= BIO_CONSTANTS.BROOD_TEMP_MAX) {
            this.ticksLeft--;
        }
        if (this.ticksLeft <= 0) {
            this.alive = false;
            return new Larva(this.position.x, this.position.y);
        }
        return null;
    }
}

class Larva extends ColonyMember {
    constructor(x, y) {
        super(x, y);
        this.ticksLeft = BIO_CONSTANTS.LARVAE_PUPATE_TICKS;
        this.fedDelay = 0;
        this.radius = 2;
        this.foodPheromone = 5;
    }

    tick(foodAvailable) {
        super.tick();
        const progress = 1 - (this.ticksLeft / BIO_CONSTANTS.LARVAE_PUPATE_TICKS);
        this.radius = 2 + progress * 3;

        if (foodAvailable > 0) {
            this.fedDelay = 0;
            this.ticksLeft--;
        } else {
            this.fedDelay++;
            if (this.fedDelay > 50) {
                this.alive = false;
                return null;
            }
        }

        if (this.ticksLeft <= 0) {
            this.alive = false;
            return new Pupa(this.position.x, this.position.y);
        }
        return null;
    }
}

class Pupa extends ColonyMember {
    constructor(x, y) {
        super(x, y);
        this.ticksLeft = BIO_CONSTANTS.PUPAE_ECLOSE_TICKS;
        const r = Math.random();
        if (r < BIO_CONSTANTS.WORKER_CASTE_PROBABILITY) this.caste = 'worker';
        else if (r < BIO_CONSTANTS.WORKER_CASTE_PROBABILITY + BIO_CONSTANTS.SOLDIER_CASTE_PROBABILITY) this.caste = 'soldier';
        else this.caste = 'queen';
    }

    tick(queenPresent) {
        super.tick();
        this.ticksLeft--;
        if (this.ticksLeft <= 0) {
            this.alive = false;
            let caste = this.caste;
            if (caste === 'queen' && queenPresent) caste = 'worker';
            return caste;
        }
        return null;
    }
}

class Ant extends ColonyMember {
    constructor(x, y, caste) {
        super(x, y);
        this.caste = caste;
        this.energy = 100;
        this.maxEnergy = 100;
        this.carrying = null;
        this.carryAmount = 0;
        this.state = 'EXPLORE';
        this.angle = Math.random() * Math.PI * 2;
        this.pheromoneMemory = [];
        this.lifespan = BIO_CONSTANTS.WORKER_LIFESPAN_TICKS;
        this.callowTicks = BIO_CONSTANTS.CALLOW_DURATION_TICKS;
        this.pheromoneSensitivity = BIO_CONSTANTS.CALLOW_PHEROMONE_SENSITIVITY_START;
        this.legPhase = Math.random() * Math.PI * 2;
        this.antennaAngle = 0;
        this.groomTimer = 0;
        this.loopTimer = 0;
        this.lastPositions = [];
        this.tandemTarget = null;
        this.isDead = false;
        this.necromoneTimer = 0;
        this.parasites = Math.floor(Math.random() * 3);
    }

    get speed() { return 1; }
    get effectiveSpeed() {
        if (this.callowTicks > 0) return this.speed * BIO_CONSTANTS.CALLOW_SPEED_FACTOR;
        return this.speed;
    }

    consumeEnergy(amount) {
        this.energy -= amount;
        if (this.energy <= 0) this.die();
    }

    die() {
        this.isDead = true;
        this.alive = false;
        this.necromoneTimer = BIO_CONSTANTS.NECROMONE_EMISSION_TICKS;
    }

    receiveFeed(amount) {
        this.energy = Math.min(this.maxEnergy, this.energy + amount);
    }

    updateCallow() {
        if (this.callowTicks > 0) {
            this.callowTicks--;
            const progress = 1 - (this.callowTicks / BIO_CONSTANTS.CALLOW_DURATION_TICKS);
            this.pheromoneSensitivity = BIO_CONSTANTS.CALLOW_PHEROMONE_SENSITIVITY_START +
                (1.0 - BIO_CONSTANTS.CALLOW_PHEROMONE_SENSITIVITY_START) * progress;
        }
    }

    samplePheromone(pheromoneSystem, type) {
        const spread = Math.PI / 4;
        const angles = [this.angle, this.angle - spread, this.angle + spread];
        return angles.map(a => {
            const nx = this.position.x + Math.cos(a) * 10;
            const ny = this.position.y + Math.sin(a) * 10;
            return pheromoneSystem.get(type, nx, ny) * this.pheromoneSensitivity;
        });
    }

    moveWithGradient(pheromoneSystem, type, world) {
        const samples = this.samplePheromone(pheromoneSystem, type);
        const noise = (Math.random() - 0.5) * 0.3;
        if (samples[0] > BIO_CONSTANTS.PHEROMONE_THRESHOLD_FOLLOW ||
            samples[1] > BIO_CONSTANTS.PHEROMONE_THRESHOLD_FOLLOW ||
            samples[2] > BIO_CONSTANTS.PHEROMONE_THRESHOLD_FOLLOW) {
            if (samples[1] > samples[0] && samples[1] > samples[2]) this.angle -= Math.PI / 6;
            else if (samples[2] > samples[0] && samples[2] > samples[1]) this.angle += Math.PI / 6;
        }
        this.angle += noise;
        this.moveForward(world);
    }

    moveForward(world) {
        const spd = this.effectiveSpeed;
        const nx = this.position.x + Math.cos(this.angle) * spd;
        const ny = this.position.y + Math.sin(this.angle) * spd;
        if (!world.isBlocked(nx, ny)) {
            this.position.x = nx;
            this.position.y = ny;
        } else {
            this.angle += Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        }
        this.legPhase += 0.25;

        this.lastPositions.push({ x: this.position.x, y: this.position.y });
        if (this.lastPositions.length > BIO_CONSTANTS.LOOPING_DETECTION_TICKS) {
            this.lastPositions.shift();
        }
        this.checkLooping();
    }

    checkLooping() {
        if (this.lastPositions.length >= BIO_CONSTANTS.LOOPING_DETECTION_TICKS) {
            const first = this.lastPositions[0];
            const last = this.lastPositions[this.lastPositions.length - 1];
            if (dist(first, last) < 15) {
                this.pheromoneMemory = [];
                this.angle = Math.random() * Math.PI * 2;
                this.lastPositions = [];
            }
        }
    }

    tick(world, pheromoneSystem, nest, colony) {
        super.tick();
        this.updateCallow();
        this.consumeEnergy(BIO_CONSTANTS.ADULT_FOOD_NEED_PER_TICK);
        if (!this.alive) return;
        if (this.age > this.lifespan) this.die();
    }
}

class WorkerAnt extends Ant {
    constructor(x, y) {
        super(x, y, 'worker');
        this.lifespan = BIO_CONSTANTS.WORKER_LIFESPAN_TICKS;
        this.carryCapacity = BIO_CONSTANTS.WORKER_CARRY_CAPACITY;
        this.state = 'EXPLORE';
        this.targetFood = null;
        this.bridgePartner = null;
        this.groomTarget = null;
        this.homePath = [];
        this.collectingFrom = null;
    }

    get speed() { return BIO_CONSTANTS.WORKER_SPEED; }

    tick(world, pheromoneSystem, nest, colony) {
        super.tick(world, pheromoneSystem, nest, colony);
        if (!this.alive) return;

        pheromoneSystem.deposit('territory', this.position.x, this.position.y, BIO_CONSTANTS.PHEROMONE_DEPOSIT_TERRITORY * 0.1);

        switch (this.state) {
            case 'EXPLORE': this.doExplore(world, pheromoneSystem, nest, colony); break;
            case 'FOLLOW_TRAIL': this.doFollowTrail(world, pheromoneSystem, nest, colony); break;
            case 'COLLECT': this.doCollect(world, pheromoneSystem, nest, colony); break;
            case 'RETURN_HOME': this.doReturnHome(world, pheromoneSystem, nest, colony); break;
            case 'FEED_LARVAE': this.doFeedLarvae(world, pheromoneSystem, nest, colony); break;
            case 'FLEE': this.doFlee(world, pheromoneSystem, nest, colony); break;
            case 'GROOM': this.doGroom(colony); break;
            case 'BRIDGE': this.doBridge(world, pheromoneSystem); break;
        }

        const alarmLevel = pheromoneSystem.get('alarm', this.position.x, this.position.y);
        if (alarmLevel > 20 && this.state !== 'FLEE') {
            this.state = 'FLEE';
        }

        this.doTrophallaxis(colony);
    }

    doExplore(world, pheromoneSystem, nest, colony) {
        const trailSamples = this.samplePheromone(pheromoneSystem, 'trail');
        const maxTrail = Math.max(...trailSamples);
        if (maxTrail > BIO_CONSTANTS.PHEROMONE_THRESHOLD_FOLLOW) {
            this.state = 'FOLLOW_TRAIL';
            return;
        }

        const recruitSamples = this.samplePheromone(pheromoneSystem, 'recruit');
        if (Math.max(...recruitSamples) > BIO_CONSTANTS.PHEROMONE_THRESHOLD_FOLLOW) {
            this.state = 'FOLLOW_TRAIL';
            return;
        }

        for (const food of colony.foodItems) {
            if (food.alive && dist(this.position, food.position) < BIO_CONSTANTS.WORKER_VISION_RADIUS) {
                this.targetFood = food;
                this.state = 'COLLECT';
                return;
            }
        }

        this.angle += (Math.random() - 0.5) * 0.4;
        this.moveForward(world);

        if (Math.random() < 0.005 && colony.ants.filter(a => a instanceof WorkerAnt && a.state === 'GROOM').length < 3) {
            this.state = 'GROOM';
            this.groomTimer = BIO_CONSTANTS.GROOM_DURATION_TICKS;
        }
    }

    doFollowTrail(world, pheromoneSystem, nest, colony) {
        this.moveWithGradient(pheromoneSystem, 'trail', world);
        for (const food of colony.foodItems) {
            if (food.alive && dist(this.position, food.position) < 20) {
                this.targetFood = food;
                this.state = 'COLLECT';
                return;
            }
        }
        const nestDist = dist(this.position, nest.entrance);
        if (nestDist < 30) {
            this.state = 'EXPLORE';
        }
    }

    doCollect(world, pheromoneSystem, nest, colony) {
        if (!this.targetFood || !this.targetFood.alive) {
            this.targetFood = null;
            this.state = 'EXPLORE';
            return;
        }
        const d = dist(this.position, this.targetFood.position);
        if (d < 15) {
            if (this.targetFood.type === 'HONEYDEW') {
                this.energy = Math.min(this.maxEnergy, this.energy + 20);
                this.carrying = 'HONEYDEW';
                this.carryAmount = 10;
                this.state = 'RETURN_HOME';
                if (this.targetFood.quantity > 50) {
                    pheromoneSystem.deposit('recruit', this.position.x, this.position.y, BIO_CONSTANTS.PHEROMONE_DEPOSIT_RECRUIT);
                }
            } else {
                const take = Math.min(this.carryCapacity, this.targetFood.quantity);
                this.targetFood.quantity -= take;
                this.carrying = this.targetFood.type;
                this.carryAmount = take;
                if (this.targetFood.quantity <= 0) this.targetFood.alive = false;
                this.state = 'RETURN_HOME';
                if (take >= 2) {
                    pheromoneSystem.deposit('recruit', this.position.x, this.position.y, BIO_CONSTANTS.PHEROMONE_DEPOSIT_RECRUIT);
                }
            }
        } else {
            const ax = (this.targetFood.position.x - this.position.x) / d;
            const ay = (this.targetFood.position.y - this.position.y) / d;
            this.angle = Math.atan2(ay, ax) + (Math.random() - 0.5) * 0.3;
            this.moveForward(world);
        }
    }

    doReturnHome(world, pheromoneSystem, nest, colony) {
        const d = dist(this.position, nest.entrance);
        pheromoneSystem.deposit('trail', this.position.x, this.position.y, BIO_CONSTANTS.PHEROMONE_DEPOSIT_TRAIL);

        if (d < 20) {
            if (this.carrying) {
                nest.foodStorage += this.carryAmount;
                this.carrying = null;
                this.carryAmount = 0;
            }
            if (colony.brood.filter(b => b instanceof Larva && b.alive).length > 0) {
                this.state = 'FEED_LARVAE';
            } else {
                this.state = 'EXPLORE';
            }
        } else {
            const ax = (nest.entrance.x - this.position.x) / d;
            const ay = (nest.entrance.y - this.position.y) / d;
            this.angle = Math.atan2(ay, ax) + (Math.random() - 0.5) * 0.2;
            this.moveForward(world);
        }
    }

    doFeedLarvae(world, pheromoneSystem, nest, colony) {
        const larvae = colony.brood.filter(b => b instanceof Larva && b.alive);
        if (larvae.length === 0 || nest.foodStorage < 1) {
            this.state = 'EXPLORE';
            return;
        }
        const target = larvae[0];
        const d = dist(this.position, target.position);
        if (d < 15) {
            nest.foodStorage -= BIO_CONSTANTS.LARVAE_FOOD_NEED_PER_TICK * 20;
            target.fedDelay = 0;
            this.state = 'EXPLORE';
        } else {
            const ax = (target.position.x - this.position.x) / d;
            const ay = (target.position.y - this.position.y) / d;
            this.angle = Math.atan2(ay, ax) + (Math.random() - 0.5) * 0.2;
            this.moveForward(world);
        }
    }

    doFlee(world, pheromoneSystem, nest, colony) {
        const d = dist(this.position, nest.entrance);
        pheromoneSystem.deposit('alarm', this.position.x, this.position.y, 10);
        if (d < 30) {
            this.state = 'EXPLORE';
            return;
        }
        const ax = (nest.entrance.x - this.position.x) / d;
        const ay = (nest.entrance.y - this.position.y) / d;
        this.angle = Math.atan2(ay, ax);
        this.moveForward(world);
    }

    doGroom(colony) {
        this.groomTimer--;
        this.parasites = Math.max(0, this.parasites - 0.1);
        for (const ant of colony.ants) {
            if (ant !== this && ant.alive && dist(this.position, ant.position) < 12) {
                ant.parasites = Math.max(0, ant.parasites - 0.05);
            }
        }
        if (this.groomTimer <= 0) this.state = 'EXPLORE';
    }

    doBridge(world, pheromoneSystem) {
        pheromoneSystem.deposit('trail', this.position.x, this.position.y, BIO_CONSTANTS.PHEROMONE_DEPOSIT_TRAIL * 0.5);
        if (Math.random() < 0.01) this.state = 'EXPLORE';
    }

    doTrophallaxis(colony) {
        if (this.energy > 70 && this.carryAmount > 0) {
            for (const ant of colony.ants) {
                if (ant !== this && ant instanceof WorkerAnt && ant.alive &&
                    ant.energy < 40 && dist(this.position, ant.position) < BIO_CONSTANTS.TROPHALLAXIS_RADIUS) {
                    const transfer = Math.min(10, this.carryAmount);
                    ant.receiveFeed(transfer);
                    this.carryAmount -= transfer;
                    break;
                }
            }
        }
    }
}

class SoldierAnt extends Ant {
    constructor(x, y) {
        super(x, y, 'soldier');
        this.lifespan = BIO_CONSTANTS.SOLDIER_LIFESPAN_TICKS;
        this.carryCapacity = BIO_CONSTANTS.SOLDIER_CARRY_CAPACITY;
        this.state = 'PATROL';
        this.patrolAngle = Math.random() * Math.PI * 2;
        this.attackTarget = null;
        this.combatRadius = 18 * 1.8;
    }

    get speed() { return BIO_CONSTANTS.SOLDIER_SPEED; }

    tick(world, pheromoneSystem, nest, colony) {
        super.tick(world, pheromoneSystem, nest, colony);
        if (!this.alive) return;

        const alarmLevel = pheromoneSystem.get('alarm', this.position.x, this.position.y);
        if (alarmLevel > BIO_CONSTANTS.PHEROMONE_THRESHOLD_FOLLOW * 3 && this.state !== 'ATTACK') {
            this.state = 'RESPOND_ALARM';
        }

        switch (this.state) {
            case 'PATROL': this.doPatrol(world, pheromoneSystem, nest, colony); break;
            case 'GUARD_ENTRANCE': this.doGuardEntrance(nest); break;
            case 'ATTACK': this.doAttack(world, pheromoneSystem, colony); break;
            case 'RESPOND_ALARM': this.doRespondAlarm(world, pheromoneSystem, nest, colony); break;
            case 'ESCORT': this.doEscort(world, nest); break;
        }
    }

    doPatrol(world, pheromoneSystem, nest, colony) {
        this.patrolAngle += (Math.random() - 0.5) * 0.1;
        const targetX = nest.entrance.x + Math.cos(this.patrolAngle) * 80;
        const targetY = nest.entrance.y + Math.sin(this.patrolAngle) * 80;
        const d = dist(this.position, { x: targetX, y: targetY });
        if (d < 10) this.patrolAngle += Math.PI / 3;
        else {
            this.angle = Math.atan2(targetY - this.position.y, targetX - this.position.x) + (Math.random() - 0.5) * 0.2;
            this.moveForward(world);
        }

        for (const pred of colony.predators) {
            if (pred.alive && dist(this.position, pred.position) < this.combatRadius) {
                this.attackTarget = pred;
                this.state = 'ATTACK';
                pheromoneSystem.deposit('alarm', this.position.x, this.position.y, BIO_CONSTANTS.PHEROMONE_DEPOSIT_ALARM);
                return;
            }
        }

        if (Math.random() < 0.005) this.state = 'GUARD_ENTRANCE';
    }

    doGuardEntrance(nest) {
        const d = dist(this.position, nest.entrance);
        if (d > 25) {
            this.angle = Math.atan2(nest.entrance.y - this.position.y, nest.entrance.x - this.position.x);
        } else {
            this.angle += (Math.random() - 0.5) * 0.1;
        }
        if (Math.random() < 0.002) this.state = 'PATROL';
    }

    doAttack(world, pheromoneSystem, colony) {
        if (!this.attackTarget || !this.attackTarget.alive) {
            this.attackTarget = null;
            this.state = 'PATROL';
            return;
        }
        const d = dist(this.position, this.attackTarget.position);
        if (d < this.combatRadius) {
            this.attackTarget.takeDamage(2);
            pheromoneSystem.deposit('alarm', this.position.x, this.position.y, 15);
        } else {
            this.angle = Math.atan2(
                this.attackTarget.position.y - this.position.y,
                this.attackTarget.position.x - this.position.x
            );
            this.moveForward(world);
        }
    }

    doRespondAlarm(world, pheromoneSystem, nest, colony) {
        const samples = this.samplePheromone(pheromoneSystem, 'alarm');
        const maxIdx = samples.indexOf(Math.max(...samples));
        if (maxIdx === 1) this.angle -= Math.PI / 6;
        else if (maxIdx === 2) this.angle += Math.PI / 6;
        this.moveForward(world);

        for (const pred of colony.predators) {
            if (pred.alive && dist(this.position, pred.position) < BIO_CONSTANTS.SOLDIER_VISION_RADIUS) {
                this.attackTarget = pred;
                this.state = 'ATTACK';
                return;
            }
        }

        if (pheromoneSystem.get('alarm', this.position.x, this.position.y) < 5) {
            this.state = 'PATROL';
        }
    }

    doEscort(world, nest) {
        const d = dist(this.position, nest.entrance);
        this.angle = Math.atan2(nest.entrance.y - this.position.y, nest.entrance.x - this.position.x) + (Math.random() - 0.5) * 0.3;
        this.moveForward(world);
        if (d < 20) this.state = 'PATROL';
    }
}

class QueenAnt extends Ant {
    constructor(x, y) {
        super(x, y, 'queen');
        this.lifespan = BIO_CONSTANTS.QUEEN_LIFESPAN_TICKS;
        this.state = 'LAY_EGGS';
        this.eggTimer = 0;
        this.eggIntervalTicks = 190;
        this.chamberCenter = { x, y };
    }

    get speed() { return BIO_CONSTANTS.QUEEN_SPEED; }

    tick(world, pheromoneSystem, nest, colony) {
        this.age++;
        this.consumeEnergy(BIO_CONSTANTS.QUEEN_FOOD_CONSUMPTION);
        if (!this.alive) return;

        if (this.energy < 20 && nest.foodStorage > 1) {
            nest.foodStorage -= 1;
            this.energy = Math.min(this.maxEnergy, this.energy + 20);
        }

        this.eggTimer++;
        if (this.eggTimer >= this.eggIntervalTicks) {
            this.eggTimer = 0;
            const eggs = Math.min(BIO_CONSTANTS.QUEEN_MAX_EGGS_PER_CYCLE, 1 + Math.floor(nest.foodStorage / 50));
            for (let i = 0; i < eggs; i++) {
                const ox = this.chamberCenter.x + (Math.random() - 0.5) * 40;
                const oy = this.chamberCenter.y + (Math.random() - 0.5) * 20;
                colony.brood.push(new Egg(ox, oy));
            }
        }

        const d = dist(this.position, this.chamberCenter);
        if (d > 20) {
            this.angle = Math.atan2(this.chamberCenter.y - this.position.y, this.chamberCenter.x - this.position.x);
            const nx = this.position.x + Math.cos(this.angle) * this.speed;
            const ny = this.position.y + Math.sin(this.angle) * this.speed;
            this.position.x = nx;
            this.position.y = ny;
        } else {
            this.angle += (Math.random() - 0.5) * 0.1;
        }
    }
}

class FoodItem {
    constructor(x, y, type, quantity) {
        this.id = generateId();
        this.position = { x, y };
        this.type = type;
        this.quantity = quantity;
        this.alive = true;
        this.decayRate = BIO_CONSTANTS.FOOD_DECAY_RATE_BASE;
        this.nutritionalValue = 1.0;
    }

    tick() {
        this.quantity -= this.decayRate;
        if (this.quantity <= 0) {
            this.alive = false;
            this.quantity = 0;
        }
    }
}

class Seed extends FoodItem {
    constructor(x, y) {
        super(x, y, 'SEED', randomRange(5, 15));
        this.density = 1.0;
        this.nutritionalValue = 0.8;
    }
}

class InsectCorpse extends FoodItem {
    constructor(x, y) {
        super(x, y, 'INSECT_CORPSE', randomRange(10, 30));
        this.density = 3.0;
        this.nutritionalValue = 1.5;
        this.carrierCount = 0;
    }

    collaborativeCarry(ants) {
        const carriers = ants.filter(a => dist(a.position, this.position) < 20 && a instanceof WorkerAnt);
        this.carrierCount = carriers.length;
        return carriers.length >= BIO_CONSTANTS.COLLABORATIVE_CARRY_MIN_ANTS;
    }
}

class Honeydew extends FoodItem {
    constructor(x, y) {
        super(x, y, 'HONEYDEW', randomRange(20, 50));
        this.nutritionalValue = 1.2;
        this.decayRate = 0;
        this.regenRate = BIO_CONSTANTS.FOOD_HONEYDEW_REGEN_RATE;
        this.harvestCount = 0;
        this.maxHarvest = 3;
    }

    tick() {
        if (this.harvestCount < this.maxHarvest) {
            this.quantity = Math.min(50, this.quantity + this.regenRate);
        }
        this.harvestCount = 0;
    }
}

class ProteinFragment extends FoodItem {
    constructor(x, y) {
        super(x, y, 'PROTEIN_FRAGMENT', randomRange(3, 8));
        this.nutritionalValue = 2.0;
        this.priority = 'HIGH';
    }
}

class WorldCell {
    constructor(type) {
        this.type = type;
        this.blocked = (type === 'ROCK' || type === 'WATER');
        this.temperature = 24;
    }
}

class World {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.cells = [];
        this.windVector = { x: 0.1, y: 0.02 };
        this.isRaining = false;
        this.rainTimer = 0;
        this.initCells();
    }

    initCells() {
        for (let r = 0; r < this.rows; r++) {
            this.cells[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const surfaceRow = Math.floor(this.rows * 0.38);
                if (r < surfaceRow) {
                    this.cells[r][c] = new WorldCell('SURFACE');
                } else {
                    this.cells[r][c] = new WorldCell('SOIL');
                }
            }
        }
        for (let i = 0; i < 6; i++) {
            const rc = Math.floor(Math.random() * this.rows);
            const cc = Math.floor(Math.random() * this.cols);
            if (this.cells[rc] && this.cells[rc][cc]) {
                const type = Math.random() < 0.5 ? 'ROCK' : 'WATER';
                this.cells[rc][cc] = new WorldCell(type);
                if (this.cells[rc][cc + 1]) this.cells[rc][cc + 1] = new WorldCell(type);
                if (this.cells[rc + 1] && this.cells[rc + 1][cc]) this.cells[rc + 1][cc] = new WorldCell(type);
            }
        }
    }

    getCell(x, y) {
        const c = Math.floor(x / this.cellSize);
        const r = Math.floor(y / this.cellSize);
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
        return this.cells[r][c];
    }

    isBlocked(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return true;
        const cell = this.getCell(x, y);
        return cell ? cell.blocked : true;
    }

    isSurface(x, y) {
        const cell = this.getCell(x, y);
        return cell && cell.type === 'SURFACE';
    }

    updateTemperatures(ambientTemp) {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.cells[r][c];
                if (cell.type === 'SURFACE') cell.temperature = ambientTemp;
                else if (cell.type === 'WATER') cell.temperature = ambientTemp * 0.85;
                else cell.temperature = ambientTemp - 2 + Math.random() * 0.5;
            }
        }
    }

    tick(tick) {
        this.rainTimer++;
        if (this.rainTimer > 8000 && Math.random() < 0.0001) {
            this.isRaining = !this.isRaining;
            this.rainTimer = 0;
        }
        const windPhase = tick * 0.0001;
        this.windVector.x = Math.cos(windPhase) * BIO_CONSTANTS.WIND_PHEROMONE_DRIFT * 0.5;
        this.windVector.y = Math.sin(windPhase * 0.7) * BIO_CONSTANTS.WIND_PHEROMONE_DRIFT * 0.2;
    }
}

class Chamber {
    constructor(x, y, w, h, type) {
        this.x = x; this.y = y;
        this.width = w; this.height = h;
        this.type = type;
        this.center = { x: x + w / 2, y: y + h / 2 };
    }

    contains(px, py) {
        return px >= this.x && px <= this.x + this.width &&
            py >= this.y && py <= this.y + this.height;
    }
}

class Tunnel {
    constructor(x1, y1, x2, y2, width) {
        this.x1 = x1; this.y1 = y1;
        this.x2 = x2; this.y2 = y2;
        this.width = width || 8;
        this.length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
}

class Nest {
    constructor(entranceX, entranceY) {
        this.entrance = { x: entranceX, y: entranceY };
        this.emergencyExits = [
            { x: entranceX - 50, y: entranceY, active: false },
            { x: entranceX + 50, y: entranceY, active: false }
        ];
        this.foodStorage = 150;
        this.starvationTimer = 0;
        this.chambers = [];
        this.tunnels = [];
        this.buildNest(entranceX, entranceY);
    }

    buildNest(ex, ey) {
        const baseY = ey + 40;
        this.queenChamber = new Chamber(ex - 30, baseY + 60, 60, 35, 'QUEEN_CHAMBER');
        this.broodChambers = [
            new Chamber(ex - 70, baseY + 30, 55, 30, 'BROOD_CHAMBER'),
            new Chamber(ex + 15, baseY + 30, 55, 30, 'BROOD_CHAMBER')
        ];
        this.foodChambers = [
            new Chamber(ex - 80, baseY + 80, 50, 25, 'FOOD_STORAGE'),
            new Chamber(ex + 30, baseY + 80, 50, 25, 'FOOD_STORAGE')
        ];
        this.wasteChamber = new Chamber(ex - 20, baseY + 120, 40, 20, 'WASTE_CHAMBER');
        this.dormitory = new Chamber(ex + 60, baseY + 60, 50, 28, 'WORKER_DORMITORY');

        this.chambers = [
            this.queenChamber,
            ...this.broodChambers,
            ...this.foodChambers,
            this.wasteChamber,
            this.dormitory
        ];

        this.tunnels = [
            new Tunnel(ex, ey, ex, baseY + 75, 8),
            new Tunnel(ex, baseY + 75, this.queenChamber.center.x, this.queenChamber.center.y, 7),
            new Tunnel(ex, baseY + 75, this.broodChambers[0].center.x, this.broodChambers[0].center.y, 6),
            new Tunnel(ex, baseY + 75, this.broodChambers[1].center.x, this.broodChambers[1].center.y, 6),
            new Tunnel(this.queenChamber.center.x, this.queenChamber.center.y, this.foodChambers[0].center.x, this.foodChambers[0].center.y, 6),
            new Tunnel(this.queenChamber.center.x, this.queenChamber.center.y, this.foodChambers[1].center.x, this.foodChambers[1].center.y, 6),
            new Tunnel(this.queenChamber.center.x, this.queenChamber.center.y, this.wasteChamber.center.x, this.wasteChamber.center.y, 5),
            new Tunnel(this.foodChambers[1].center.x, this.foodChambers[1].center.y, this.dormitory.center.x, this.dormitory.center.y, 6)
        ];
    }

    tick(alarmLevel) {
        if (alarmLevel > 40) {
            this.emergencyExits.forEach(e => e.active = true);
        } else if (alarmLevel < 10) {
            this.emergencyExits.forEach(e => e.active = false);
        }
        if (this.foodStorage <= 0) {
            this.foodStorage = 0;
            this.starvationTimer++;
        } else {
            this.starvationTimer = 0;
        }
    }
}

class PheromoneLayer {
    constructor(width, height, cellSize, decayRate) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.data = new Float32Array(this.cols * this.rows);
        this.decayRate = decayRate;
    }

    idx(x, y) {
        const c = Math.floor(x / this.cellSize);
        const r = Math.floor(y / this.cellSize);
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
        return r * this.cols + c;
    }

    get(x, y) {
        const i = this.idx(x, y);
        return i >= 0 ? this.data[i] : 0;
    }

    deposit(x, y, amount) {
        const i = this.idx(x, y);
        if (i >= 0) this.data[i] = Math.min(255, this.data[i] + amount);
    }

    decay(rainFactor) {
        const rate = this.decayRate * (rainFactor || 1);
        for (let i = 0; i < this.data.length; i++) {
            this.data[i] *= (1 - rate);
            if (this.data[i] < 0.01) this.data[i] = 0;
        }
    }

    diffuse() {
        const next = new Float32Array(this.data.length);
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const i = r * this.cols + c;
                let sum = 0, count = 0;
                for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                        sum += this.data[nr * this.cols + nc];
                        count++;
                    }
                }
                const avg = sum / count;
                next[i] = this.data[i] + 0.05 * (avg - this.data[i]);
            }
        }
        this.data = next;
    }
}

class PheromoneSystem {
    constructor(width, height, cellSize) {
        const cs = cellSize || 8;
        this.layers = {
            trail: new PheromoneLayer(width, height, cs, BIO_CONSTANTS.PHEROMONE_TRAIL_DECAY),
            alarm: new PheromoneLayer(width, height, cs, BIO_CONSTANTS.PHEROMONE_ALARM_DECAY),
            territory: new PheromoneLayer(width, height, cs, BIO_CONSTANTS.PHEROMONE_TERRITORY_DECAY),
            recruit: new PheromoneLayer(width, height, cs, BIO_CONSTANTS.PHEROMONE_RECRUIT_DECAY),
            necromone: new PheromoneLayer(width, height, cs, BIO_CONSTANTS.PHEROMONE_ALARM_DECAY)
        };
    }

    get(type, x, y) {
        return this.layers[type] ? this.layers[type].get(x, y) : 0;
    }

    deposit(type, x, y, amount) {
        if (this.layers[type]) this.layers[type].deposit(x, y, amount);
    }

    tick(isRaining) {
        const rain = isRaining ? BIO_CONSTANTS.RAIN_PHEROMONE_DILUTION_FACTOR : 1;
        for (const layer of Object.values(this.layers)) {
            layer.decay(rain);
            layer.diffuse();
        }
    }
}

class Predator {
    constructor(x, y) {
        this.id = generateId();
        this.position = { x, y };
        this.alive = true;
        this.health = 50;
        this.speed = 0.8;
        this.angle = Math.random() * Math.PI * 2;
        this.eatTimer = 0;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) this.alive = false;
    }

    tick(world, pheromoneSystem, ants) {
        this.angle += (Math.random() - 0.5) * 0.3;
        const nx = this.position.x + Math.cos(this.angle) * this.speed;
        const ny = this.position.y + Math.sin(this.angle) * this.speed;
        if (!world.isBlocked(nx, ny)) {
            this.position.x = nx;
            this.position.y = ny;
        } else {
            this.angle += Math.PI / 2;
        }

        pheromoneSystem.deposit('alarm', this.position.x, this.position.y, 5);

        this.eatTimer++;
        if (this.eatTimer > 30) {
            this.eatTimer = 0;
            for (const ant of ants) {
                if (ant.alive && dist(this.position, ant.position) < BIO_CONSTANTS.PREDATOR_EAT_RADIUS) {
                    ant.die();
                    pheromoneSystem.deposit('alarm', this.position.x, this.position.y, BIO_CONSTANTS.PHEROMONE_DEPOSIT_ALARM);
                    break;
                }
            }
        }

        if (this.position.x < 0 || this.position.x > 1200 || this.position.y < 0) {
            this.alive = false;
        }
    }
}

class Colony {
    constructor(nest) {
        this.nest = nest;
        this.ants = [];
        this.brood = [];
        this.foodItems = [];
        this.predators = [];
        this.queen = null;
        this.queenPresent = false;
        this.deadAnts = [];
        this.tickCount = 0;
    }

    addQueen(x, y) {
        this.queen = new QueenAnt(x, y);
        this.ants.push(this.queen);
        this.queenPresent = true;
    }

    addWorker(x, y) {
        const w = new WorkerAnt(x, y);
        this.ants.push(w);
        return w;
    }

    addSoldier(x, y) {
        const s = new SoldierAnt(x, y);
        this.ants.push(s);
        return s;
    }

    spawnAntFromCaste(caste) {
        const { x, y } = this.nest.entrance;
        const ox = x + (Math.random() - 0.5) * 20;
        const oy = y + (Math.random() - 0.5) * 10;
        if (caste === 'worker') return this.addWorker(ox, oy);
        if (caste === 'soldier') return this.addSoldier(ox, oy);
        if (caste === 'queen' && !this.queenPresent) this.addQueen(ox, oy);
    }
}

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.pheromoneCanvas = document.createElement('canvas');
        this.pheromoneCanvas.width = canvas.width;
        this.pheromoneCanvas.height = canvas.height;
        this.pCtx = this.pheromoneCanvas.getContext('2d');
    }

    clear() {
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
    }

    drawBackground(world) {
        const ctx = this.ctx;
        const surfaceH = Math.floor(world.rows * 0.38) * world.cellSize;

        const skyGrad = ctx.createLinearGradient(0, 0, 0, surfaceH);
        skyGrad.addColorStop(0, '#8dc4a8');
        skyGrad.addColorStop(1, '#a8c98c');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, world.width, surfaceH);

        if (world.isRaining) {
            ctx.fillStyle = 'rgba(100,140,180,0.18)';
            ctx.fillRect(0, 0, world.width, surfaceH);
        }

        const soilGrad = ctx.createLinearGradient(0, surfaceH, 0, world.height);
        soilGrad.addColorStop(0, '#7a5c3a');
        soilGrad.addColorStop(0.3, '#6b4f2e');
        soilGrad.addColorStop(0.7, '#5c4228');
        soilGrad.addColorStop(1, '#4a3420');
        ctx.fillStyle = soilGrad;
        ctx.fillRect(0, surfaceH, world.width, world.height - surfaceH);

        for (let r = 0; r < world.rows; r++) {
            for (let c = 0; c < world.cols; c++) {
                const cell = world.cells[r][c];
                const cx = c * world.cellSize;
                const cy = r * world.cellSize;
                if (cell.type === 'ROCK') {
                    ctx.fillStyle = '#4a4a55';
                    ctx.fillRect(cx, cy, world.cellSize, world.cellSize);
                } else if (cell.type === 'WATER') {
                    ctx.fillStyle = '#3a7abf';
                    ctx.fillRect(cx, cy, world.cellSize, world.cellSize);
                    ctx.fillStyle = 'rgba(100,180,255,0.3)';
                    ctx.fillRect(cx, cy, world.cellSize, world.cellSize * 0.4);
                }
            }
        }
    }

    drawNest(nest) {
        const ctx = this.ctx;
        ctx.save();

        for (const tunnel of nest.tunnels) {
            ctx.strokeStyle = '#3a2810';
            ctx.lineWidth = tunnel.width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tunnel.x1, tunnel.y1);
            ctx.lineTo(tunnel.x2, tunnel.y2);
            ctx.stroke();

            ctx.strokeStyle = '#4a3618';
            ctx.lineWidth = tunnel.width - 2;
            ctx.beginPath();
            ctx.moveTo(tunnel.x1, tunnel.y1);
            ctx.lineTo(tunnel.x2, tunnel.y2);
            ctx.stroke();
        }

        const chamberColors = {
            QUEEN_CHAMBER: ['#6b3a1f', '#8b5c3a', 'rgba(255,200,100,0.15)'],
            BROOD_CHAMBER: ['#4a2d12', '#6b4a2e', 'rgba(255,230,150,0.12)'],
            FOOD_STORAGE: ['#3a2810', '#5a4020', 'rgba(180,255,100,0.12)'],
            WASTE_CHAMBER: ['#2a1a08', '#3a2810', 'rgba(100,80,60,0.15)'],
            WORKER_DORMITORY: ['#3a2810', '#5a4020', 'rgba(200,200,255,0.08)']
        };

        for (const chamber of nest.chambers) {
            const colors = chamberColors[chamber.type] || ['#4a3020', '#6a5040', null];
            const grad = ctx.createRadialGradient(
                chamber.center.x, chamber.center.y, 2,
                chamber.center.x, chamber.center.y, Math.max(chamber.width, chamber.height) * 0.6
            );
            grad.addColorStop(0, colors[1]);
            grad.addColorStop(1, colors[0]);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(chamber.center.x, chamber.center.y, chamber.width / 2, chamber.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = colors[0];
            ctx.lineWidth = 1;
            ctx.stroke();

            if (colors[2]) {
                ctx.fillStyle = colors[2];
                ctx.beginPath();
                ctx.ellipse(chamber.center.x, chamber.center.y, chamber.width / 2 - 2, chamber.height / 2 - 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(chamber.type.replace('_', ' '), chamber.center.x, chamber.center.y + 3);
        }

        ctx.fillStyle = '#2a1a08';
        ctx.beginPath();
        ctx.ellipse(nest.entrance.x, nest.entrance.y, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6a4820';
        ctx.lineWidth = 2;
        ctx.stroke();

        for (const exit of nest.emergencyExits) {
            if (exit.active) {
                ctx.fillStyle = 'rgba(255,80,0,0.6)';
                ctx.beginPath();
                ctx.ellipse(exit.x, exit.y, 5, 3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawPheromones(pheromoneSystem) {
        const pCtx = this.pCtx;
        pCtx.clearRect(0, 0, this.pheromoneCanvas.width, this.pheromoneCanvas.height);
        const cs = pheromoneSystem.layers.trail.cellSize;
        const cols = pheromoneSystem.layers.trail.cols;
        const rows = pheromoneSystem.layers.trail.rows;

        const pheroTypes = [
            { name: 'trail', r: 230, g: 180, b: 50 },
            { name: 'alarm', r: 220, g: 30, b: 30 },
            { name: 'territory', r: 50, g: 80, b: 200 },
            { name: 'recruit', r: 220, g: 120, b: 20 },
            { name: 'necromone', r: 150, g: 50, b: 150 }
        ];

        for (const pt of pheroTypes) {
            const layer = pheromoneSystem.layers[pt.name];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const v = layer.data[r * cols + c];
                    if (v < 0.5) continue;
                    const alpha = Math.min(0.7, v / 255 * 2.5);
                    pCtx.fillStyle = `rgba(${pt.r},${pt.g},${pt.b},${alpha.toFixed(3)})`;
                    pCtx.fillRect(c * cs, r * cs, cs, cs);
                }
            }
        }

        this.ctx.save();
        this.ctx.globalAlpha = 0.65;
        this.ctx.drawImage(this.pheromoneCanvas, 0, 0);
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }

    drawAnt(ant, tick) {
        const ctx = this.ctx;
        const { x, y } = ant.position;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ant.angle + Math.PI / 2);

        const isCallow = ant.callowTicks > 0;
        let headColor, thoraxColor, gasterColor, legColor;

        if (ant.caste === 'queen') {
            headColor = '#d4a017'; thoraxColor = '#c8920e'; gasterColor = '#b87d0a'; legColor = '#8b6010';
        } else if (ant.caste === 'soldier') {
            headColor = '#2a1a06'; thoraxColor = '#1a1008'; gasterColor = '#0a0804'; legColor = '#3a2a10';
        } else {
            headColor = isCallow ? '#c8a87a' : '#3d2510';
            thoraxColor = isCallow ? '#b89060' : '#2d1a08';
            gasterColor = isCallow ? '#a07850' : '#1a0e04';
            legColor = isCallow ? '#d0b090' : '#4a3020';
        }

        const scale = ant.caste === 'queen' ? 1.7 : ant.caste === 'soldier' ? 1.3 : 1.0;
        const legSwing = Math.sin(ant.legPhase) * 0.35;

        ctx.strokeStyle = legColor;
        ctx.lineWidth = 0.7;
        for (let side = -1; side <= 1; side += 2) {
            for (let leg = 0; leg < 3; leg++) {
                const ly = -3 + leg * 3;
                const swing = legSwing * (leg % 2 === 0 ? 1 : -1) * side;
                ctx.beginPath();
                ctx.moveTo(side * 2 * scale, ly * scale);
                ctx.lineTo(side * (6 + swing * 3) * scale, (ly + swing * 2) * scale);
                ctx.stroke();
            }
        }

        ctx.fillStyle = gasterColor;
        ctx.beginPath();
        ctx.ellipse(0, 6 * scale, 3.5 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = thoraxColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.2 * scale, 2.8 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.ellipse(0, -5 * scale, 3 * scale * (ant.caste === 'soldier' ? 1.4 : 1), 2.8 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        const antennaTick = tick * 0.05;
        const antennaBase = -6 * scale;
        for (let side = -1; side <= 1; side += 2) {
            const antennaSwing = Math.sin(antennaTick + side) * 0.4 + ant.antennaAngle * 0.5;
            ctx.strokeStyle = legColor;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(side * 1.5 * scale, antennaBase);
            const mx = side * (4 + Math.cos(antennaSwing) * 3) * scale;
            const my = antennaBase - 5 * scale;
            const ex2 = mx + side * 2 * scale;
            const ey2 = my - 3 * scale;
            ctx.quadraticCurveTo(mx, my, ex2, ey2);
            ctx.stroke();
            ctx.fillStyle = legColor;
            ctx.beginPath();
            ctx.arc(ex2, ey2, 0.9 * scale, 0, Math.PI * 2);
            ctx.fill();
        }

        if (ant.carrying && ant.carryAmount > 0) {
            ctx.fillStyle = ant.carrying === 'SEED' ? '#d4a840' :
                ant.carrying === 'PROTEIN_FRAGMENT' ? '#e06030' :
                    ant.carrying === 'HONEYDEW' ? '#60c860' : '#c8c060';
            ctx.beginPath();
            ctx.arc(0, -8 * scale, 2.5 * scale, 0, Math.PI * 2);
            ctx.fill();
        }

        if (ant.caste === 'queen') {
            ctx.save();
            ctx.globalAlpha = 0.18 + 0.08 * Math.sin(tick * 0.05);
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.ellipse(0, 0, 14, 20, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }

    drawBrood(brood) {
        const ctx = this.ctx;
        for (const member of brood) {
            if (!member.alive) continue;
            const { x, y } = member.position;
            if (member instanceof Egg) {
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.beginPath();
                ctx.ellipse(x, y, 2, 3, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (member instanceof Larva) {
                const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.003);
                ctx.fillStyle = `rgba(255,240,200,${pulse})`;
                ctx.beginPath();
                ctx.arc(x, y, member.radius, 0, Math.PI * 2);
                ctx.fill();
            } else if (member instanceof Pupa) {
                ctx.fillStyle = 'rgba(200,180,140,0.9)';
                ctx.beginPath();
                ctx.ellipse(x, y, 4, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(150,130,100,0.6)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    drawFoodItems(foodItems) {
        const ctx = this.ctx;
        for (const food of foodItems) {
            if (!food.alive) continue;
            const { x, y } = food.position;
            ctx.save();
            ctx.globalAlpha = Math.min(1, food.quantity / 15);
            if (food.type === 'SEED') {
                ctx.fillStyle = '#d4a040';
                ctx.beginPath();
                ctx.ellipse(x, y, 4, 6, 0.3, 0, Math.PI * 2);
                ctx.fill();
            } else if (food.type === 'INSECT_CORPSE') {
                ctx.fillStyle = '#8a5030';
                ctx.beginPath();
                ctx.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#6a3820';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else if (food.type === 'HONEYDEW') {
                ctx.fillStyle = '#70e870';
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(100,255,100,0.3)';
                ctx.beginPath();
                ctx.arc(x, y, 9, 0, Math.PI * 2);
                ctx.fill();
            } else if (food.type === 'PROTEIN_FRAGMENT') {
                ctx.fillStyle = '#e05020';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    drawPredators(predators) {
        const ctx = this.ctx;
        for (const pred of predators) {
            if (!pred.alive) continue;
            const { x, y } = pred.position;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(pred.angle);
            ctx.fillStyle = '#8a1515';
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c02020';
            ctx.beginPath();
            ctx.ellipse(0, -10, 6, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ff4040';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, BIO_CONSTANTS.PREDATOR_EAT_RADIUS, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawRain(world) {
        if (!world.isRaining) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = 'rgba(150,190,240,0.35)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 80; i++) {
            const rx = Math.random() * world.width;
            const ry = Math.random() * world.height * 0.4;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + 2, ry + 8);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class HUD {
    constructor(panelElement) {
        this.panel = panelElement;
    }

    update(colony, world, tick, ambientTemp) {
        const workers = colony.ants.filter(a => a instanceof WorkerAnt && a.alive).length;
        const soldiers = colony.ants.filter(a => a instanceof SoldierAnt && a.alive).length;
        const eggs = colony.brood.filter(b => b instanceof Egg && b.alive).length;
        const larvae = colony.brood.filter(b => b instanceof Larva && b.alive).length;
        const pupae = colony.brood.filter(b => b instanceof Pupa && b.alive).length;
        const day = Math.floor(tick / BIO_CONSTANTS.DAY_CYCLE_TICKS) + 1;
        const timeOfDay = ((tick % BIO_CONSTANTS.DAY_CYCLE_TICKS) / BIO_CONSTANTS.DAY_CYCLE_TICKS * 24).toFixed(1);
        const queen = colony.queen ? (colony.queen.alive ? '♛ Alive' : '✗ Dead') : '✗ None';
        const queenEnergy = colony.queen ? colony.queen.energy.toFixed(1) : '—';

        if (this.panel) {
            this.panel.innerHTML = `
        <div class="hud-section">
          <div class="hud-title">COLONY STATUS</div>
          <div class="hud-row"><span>Day</span><span>${day} (${timeOfDay}h)</span></div>
          <div class="hud-row"><span>Tick</span><span>${tick}</span></div>
          <div class="hud-row weather-row"><span>Temp</span><span>${ambientTemp.toFixed(1)}°C ${world.isRaining ? '🌧' : '☀'}</span></div>
        </div>
        <div class="hud-section">
          <div class="hud-title">POPULATION</div>
          <div class="hud-row workers"><span>Workers</span><span>${workers}</span></div>
          <div class="hud-row soldiers"><span>Soldiers</span><span>${soldiers}</span></div>
          <div class="hud-row queen-row"><span>Queen</span><span>${queen}</span></div>
          <div class="hud-row"><span>Energy</span><span>${queenEnergy}</span></div>
        </div>
        <div class="hud-section">
          <div class="hud-title">BROOD</div>
          <div class="hud-row egg-row"><span>Eggs</span><span>${eggs}</span></div>
          <div class="hud-row larva-row"><span>Larvae</span><span>${larvae}</span></div>
          <div class="hud-row pupa-row"><span>Pupae</span><span>${pupae}</span></div>
        </div>
        <div class="hud-section">
          <div class="hud-title">RESOURCES</div>
          <div class="hud-row food-row"><span>Food</span><span>${colony.nest.foodStorage.toFixed(1)}</span></div>
          <div class="food-bar"><div class="food-fill" style="width:${Math.min(100, colony.nest.foodStorage / 3)}%"></div></div>
          ${colony.nest.starvationTimer > 0 ? '<div class="hud-row warn-row"><span>⚠ Starvation</span><span>' + colony.nest.starvationTimer + '/' + BIO_CONSTANTS.COLONY_STARVATION_DEATH_TICKS + '</span></div>' : ''}
        </div>
        <div class="hud-section">
          <div class="hud-title">THREATS</div>
          <div class="hud-row predator-row"><span>Predators</span><span>${colony.predators.filter(p => p.alive).length}</span></div>
          <div class="hud-row"><span>Dead Ants</span><span>${colony.deadAnts.length}</span></div>
        </div>
        <div class="hud-section">
          <div class="hud-title">LEGEND</div>
          <div class="legend-item"><span class="dot trail-dot"></span><span>Trail pheromone</span></div>
          <div class="legend-item"><span class="dot alarm-dot"></span><span>Alarm pheromone</span></div>
          <div class="legend-item"><span class="dot recruit-dot"></span><span>Recruit pheromone</span></div>
          <div class="legend-item"><span class="dot territory-dot"></span><span>Territory pheromone</span></div>
        </div>
      `;
        }
    }
}

class Simulator {
    constructor(canvas, hudPanel) {
        this.canvas = canvas;
        this.canvas.width = 1200;
        this.canvas.height = 700;
        this.tick = 0;
        this.running = true;
        this.lastTime = 0;
        this.accum = 0;
        this.tickInterval = 1000 / 60;

        this.world = new World(1200, 700, 8);
        this.pheromoneSystem = new PheromoneSystem(1200, 700, 8);

        const entranceX = 600, entranceY = Math.floor(700 * 0.38) - 2;
        this.nest = new Nest(entranceX, entranceY);
        this.colony = new Colony(this.nest);

        this.renderer = new Renderer(canvas);
        this.hud = new HUD(hudPanel);

        this.ambientTemp = BIO_CONSTANTS.AMBIENT_TEMP_DAY;
        this.predatorTimer = 0;

        this.init();

        canvas.addEventListener('wheel', (e) => {
            this.renderer.zoom = clamp(this.renderer.zoom - e.deltaY * 0.001, 0.5, 3);
        });
    }

    init() {
        const { entrance } = this.nest;
        this.colony.addQueen(this.nest.queenChamber.center.x, this.nest.queenChamber.center.y);

        for (let i = 0; i < BIO_CONSTANTS.POPULATION_START_WORKERS; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 120;
            this.colony.addWorker(
                entrance.x + Math.cos(angle) * r,
                entrance.y + Math.sin(angle) * r * 0.3 - 5
            );
        }

        for (let i = 0; i < BIO_CONSTANTS.POPULATION_START_SOLDIERS; i++) {
            this.colony.addSoldier(
                entrance.x + (Math.random() - 0.5) * 80,
                entrance.y + (Math.random() - 0.5) * 10
            );
        }

        this.spawnFood();

        for (const chamber of this.nest.broodChambers) {
            for (let i = 0; i < 8; i++) {
                this.colony.brood.push(new Egg(
                    chamber.center.x + (Math.random() - 0.5) * 30,
                    chamber.center.y + (Math.random() - 0.5) * 15
                ));
            }
        }
    }

    spawnFood() {
        const surfaceY = Math.floor(700 * 0.38) - 5;
        const types = ['SEED', 'SEED', 'SEED', 'HONEYDEW', 'INSECT_CORPSE', 'PROTEIN_FRAGMENT'];
        for (let i = 0; i < BIO_CONSTANTS.FOOD_ITEMS_START; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const x = 80 + Math.random() * 1040;
            const y = surfaceY - Math.random() * 60;
            let food;
            if (type === 'SEED') food = new Seed(x, y);
            else if (type === 'HONEYDEW') food = new Honeydew(x, y);
            else if (type === 'INSECT_CORPSE') food = new InsectCorpse(x, y);
            else food = new ProteinFragment(x, y);
            this.colony.foodItems.push(food);
        }
    }

    updateAmbientTemp() {
        const phase = (this.tick % BIO_CONSTANTS.DAY_CYCLE_TICKS) / BIO_CONSTANTS.DAY_CYCLE_TICKS;
        const t = Math.sin(phase * Math.PI * 2 - Math.PI / 2);
        this.ambientTemp = BIO_CONSTANTS.AMBIENT_TEMP_NIGHT +
            (BIO_CONSTANTS.AMBIENT_TEMP_DAY - BIO_CONSTANTS.AMBIENT_TEMP_NIGHT) * (t * 0.5 + 0.5);
    }

    doTick() {
        this.tick++;
        this.updateAmbientTemp();
        this.world.tick(this.tick);
        this.world.updateTemperatures(this.ambientTemp);

        for (const ant of this.colony.ants) {
            if (ant.alive) ant.tick(this.world, this.pheromoneSystem, this.nest, this.colony);
        }

        const newBrood = [];
        for (const member of this.colony.brood) {
            if (!member.alive) continue;
            let result = null;
            if (member instanceof Egg) result = member.tick(this.ambientTemp);
            else if (member instanceof Larva) {
                const foodAvail = this.nest.foodStorage > BIO_CONSTANTS.LARVAE_FOOD_NEED_PER_TICK ? 1 : 0;
                if (foodAvail) this.nest.foodStorage -= BIO_CONSTANTS.LARVAE_FOOD_NEED_PER_TICK;
                result = member.tick(foodAvail);
            } else if (member instanceof Pupa) {
                result = member.tick(this.colony.queenPresent);
                if (result) {
                    this.colony.spawnAntFromCaste(result);
                    continue;
                }
            }
            if (result instanceof Larva || result instanceof Pupa) {
                newBrood.push(result);
            } else if (result === null && member.alive) {
                newBrood.push(member);
            }
        }
        this.colony.brood = newBrood;

        for (const food of this.colony.foodItems) {
            if (food.alive) food.tick();
        }
        this.colony.foodItems = this.colony.foodItems.filter(f => f.alive);

        if (Math.random() < 0.002) {
            this.spawnSingleFood();
        }

        this.predatorTimer++;
        if (this.predatorTimer >= BIO_CONSTANTS.PREDATOR_APPEAR_INTERVAL_TICKS) {
            this.predatorTimer = 0;
            const surfaceY = Math.floor(700 * 0.38) - 5;
            const side = Math.random() < 0.5 ? 20 : 1180;
            this.colony.predators.push(new Predator(side, surfaceY - 20 - Math.random() * 40));
        }

        for (const pred of this.colony.predators) {
            if (pred.alive) pred.tick(this.world, this.pheromoneSystem, this.colony.ants);
        }
        this.colony.predators = this.colony.predators.filter(p => p.alive);

        this.colony.ants = this.colony.ants.filter(a => {
            if (!a.alive) {
                if (a.caste === 'queen') this.colony.queenPresent = false;
                if (a.isDead) {
                    this.colony.deadAnts.push({ x: a.position.x, y: a.position.y, timer: 60 });
                    this.pheromoneSystem.deposit('necromone', a.position.x, a.position.y, 40);
                    this.pheromoneSystem.deposit('alarm', a.position.x, a.position.y, 20);
                }
                return false;
            }
            return true;
        });

        this.colony.deadAnts = this.colony.deadAnts.filter(d => { d.timer--; return d.timer > 0; });

        const nestAlarm = this.pheromoneSystem.get('alarm', this.nest.entrance.x, this.nest.entrance.y);
        this.nest.tick(nestAlarm);

        this.pheromoneSystem.tick(this.world.isRaining);

        if (this.nest.starvationTimer >= BIO_CONSTANTS.COLONY_STARVATION_DEATH_TICKS) {
            for (const ant of this.colony.ants) ant.die();
        }
    }

    spawnSingleFood() {
        const surfaceY = Math.floor(700 * 0.38) - 5;
        const x = 80 + Math.random() * 1040;
        const y = surfaceY - Math.random() * 60;
        const r = Math.random();
        let food;
        if (r < 0.5) food = new Seed(x, y);
        else if (r < 0.75) food = new Honeydew(x, y);
        else if (r < 0.9) food = new InsectCorpse(x, y);
        else food = new ProteinFragment(x, y);
        this.colony.foodItems.push(food);
    }

    render() {
        this.renderer.clear();
        this.renderer.drawBackground(this.world);
        this.renderer.drawPheromones(this.pheromoneSystem);
        this.renderer.drawNest(this.nest);
        this.renderer.drawBrood(this.colony.brood);
        this.renderer.drawFoodItems(this.colony.foodItems);
        this.renderer.drawPredators(this.colony.predators);

        for (const ant of this.colony.ants) {
            if (ant.alive) this.renderer.drawAnt(ant, this.tick);
        }

        for (const dead of this.colony.deadAnts) {
            const ctx = this.renderer.ctx;
            ctx.save();
            ctx.globalAlpha = dead.timer / 60;
            ctx.fillStyle = '#5a3a20';
            ctx.beginPath();
            ctx.ellipse(dead.x, dead.y, 4, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        this.renderer.drawRain(this.world);
        this.hud.update(this.colony, this.world, this.tick, this.ambientTemp);
    }

    loop(time) {
        if (!this.running) return;
        const dt = time - this.lastTime;
        this.lastTime = time;
        this.accum += dt;

        let steps = 0;
        while (this.accum >= this.tickInterval && steps < 3) {
            this.doTick();
            this.accum -= this.tickInterval;
            steps++;
        }

        this.render();
        requestAnimationFrame(t => this.loop(t));
    }

    start() {
        requestAnimationFrame(t => {
            this.lastTime = t;
            this.loop(t);
        });
    }

    pause() { this.running = !this.running; }
}

window.Simulator = Simulator;