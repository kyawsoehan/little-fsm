### Example: File Upload Behavior — Two States, Two Contexts
Let’s model a super simple file upload’s behavior. 

It has three states — `idle` and `uploading` — and two events: `started` and `completed`.

#### Define the root schema

```ts
type RootFsmScheme = {
    states: {
        'idle': {
            context: {}
        },
        'uploading': {
            context: {
                fileName: string
            }
        }
    },
    events: {
        "started" : {
            fileName: string
        },
        "completed" : {},
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
    builder.simpleState('idle')
        .transition('started', 'uploading', (c, e) => {
            return {fileName: e.fileName} // context changed
        });
    builder.simpleState('uploading')
        .transition('completed', 'idle', (c, e) => {
            return {} // context changed
        });
    return builder.build();
}
```


#### Use the machine
```ts
    let fsm = buildRootState();
    
    fsm.init('idle', {});
    console.log(fsm.getCurrentState()); // → "idle"

    // event type must match
    fsm.processEvent('started', {fileName: "photo.jpeg"}); 
    console.log(fsm.getCurrentState()); // → "uploading"

    fsm.processEvent('completed', {});
    console.log(fsm.getCurrentState()); // → "idle"
```