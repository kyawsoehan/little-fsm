### Example: Ball-point Pen — Two States, No Context
Let’s model a simple retractable ballpoint pen. It has only two states — `in` and `out` — and a single event: `press`.

This is an example of a state machine without context. In this example, only the states matter, and there’s no extra context value to keep track of.

#### Define the root schema

```ts
type RootFsmScheme = {
    states: {
        'in': NoContext, 
        'out': NoContext
    },
    events: {
        "press" : {}  // No event details
    }
}
```
There’s no additional data (context) to keep, so we use NoContext for both states.

#### Build the FSM with transition rules
```ts
function buildRootState(): Fsm<RootFsmScheme> {
    let builder = new FsmBuilder<RootFsmScheme>();
    builder.simpleState('in')
        .transition('press', 'out', (c, e) => c)
    builder.simpleState('out')
        .transition('press', 'in', retainContext)    
    return builder.build();
}
```
Use `retainContext` where there is no context change during the transition.

#### Use the machine
```ts
    let fsm = buildRootState();
    
    fsm.init('in', {})
    console.log(fsm.getCurrentState()); // → "in"

    fsm.processEvent('press', {})
    console.log(fsm.getCurrentState()); // → "out"
```