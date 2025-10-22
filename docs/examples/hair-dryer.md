### Example: Hair Dryer Behavior — Three States, Single Context
Let’s model a hair dryer’s behavior. 

It has three states — `off`, `low` and `high` — and a single event: `press`.

Each state carries the same context values: `{heat: number, speed: number}`

#### Define the root schema

```ts
type RootFsmScheme = {
    states: {
        'off': {
            context: {
                heat:number,
                speed:number
            }
        },
        'low': {
            context: {
                heat:number,
                speed:number
            }
        },
        'high': {
            context: {
                heat:number,
                speed:number
            }
        }
    },
    events: {
        "press" : {}
    }
}
```
Since all states share the same context shape, we can refactor it for clarity:

```ts
type HairDryerContext = {
    heat: number,
    speed: number
}

type RootFsmScheme = {
    states: {
        'off': {
            context: HairDryerContext
        },
        'low': {
            context: HairDryerContext
        },
        'high': {
            context: HairDryerContext
        }
    },
    events: {
        "press" : {}
    }
}
```

#### Build the FSM with transition rules

Each transition defines how the context changes when the event occurs.

The context change function signature is:
```ts
(currentContext, event) => newContext
``` 
where the return type must match the context type defined for the target state.

```ts
function buildRootState(): Fsm<RootFsmScheme> {
    let builder = new FsmBuilder<RootFsmScheme>();
    builder.simpleState('off')
        .transition('press', 'low', (c, e) => {
            return {speed: 5, heat: 5}
        })
    builder.simpleState('low')
        .transition('press', 'high', (c, e) => {
            return {speed: 10, heat: 10}
        })    
    builder.simpleState('high')
        .transition('press', 'off', (c, e) => {
            return {speed: 0, heat: 0}
        })    
    return builder.build();
}
```
You can always use `retainContext` where there is no context change during the transition.

#### Use the machine
```ts
    let fsm = buildRootState();
    
    fsm.init('off', {})
    console.log(fsm.getCurrentState()); // → "off"

    fsm.processEvent('press', {})
    console.log(fsm.getCurrentState()); // → "low"

    fsm.processEvent('press', {})
    console.log(fsm.getCurrentState()); // → "high"

    fsm.processEvent('press', {})
    console.log(fsm.getCurrentState()); // → "off"
```