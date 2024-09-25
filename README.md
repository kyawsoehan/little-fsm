# little-fsm

- [What is little-fsm?](#what-is-little-fsm)
- [Installation](#installation)
- [Quick Start](#quick-start)

## What is little-fsm?
A strongly-typed lightweight state machine. 

## Installation

### npm

```bash
npm install little-fsm --save
```
View the [npm repository](https://www.npmjs.com/package/little-fsm) of little-fsm for details.

## Quick Start

Let's construct a state machine to model the state transitions in a vending machine.

- The vending machine starts in an idle state, waiting for user interaction. 
- When a customer inserts money, the machine transitions to the ready-to-order state, signaling that it is prepared to accept a selection. 
- Once the customer chooses a product, the machine enters the dispensing state, where it delivers the chosen item to the customer.
- After dispensing, the machine transitions to the refunding state, where it returns the excess amount. 
- Once the refund (if any) is complete, the machine returns to the idle state, ready for the next customer interaction.


```js
import { NoContext, retainContext, FsmBuilder } from "little-fsm"
import { expect, test } from 'vitest'

type VendingMachineManifest = {
    states: {
        'idle': NoContext, 
        'ready-to-order': NoContext,
        'dispensing': NoContext,
        'refunding': NoContext
    },
    events: {
        "coin_inserted": {},
        "item_selected" : {},
        "dispensed": {}
        "cancelled" : {},
        "refunded" : {},
    }
}

function buildFsm(): Fsm<VendingMachineManifest> {
    let builder = new FsmBuilder<VendingMachineManifest>();

    builder.atomicState('idle')
        .transition('coin_inserted', 'ready-to-order', retainContext);

    builder.atomicState('ready-to-order')
        .transition('item_selected', 'dispensing', retainContext)
        .transition('cancelled', 'refunding', retainContext);

    builder.atomicState('dispensing')
        .transition('dispensed', 'refunding', retainContext);

    builder.atomicState('refunding')
        .transition('refunded', 'idle', retainContext);

    return builder.build();
}
```
The initial state in your vending machine's state machine can be set this way:
```js
let fsm = buildFsm();    
fsm.init('idle', {});
```

When the customer inserts money, we trigger an event to the finite state machine (FSM).
```js
fsm.processEvent('coin_inserted', {})
```

Here’s how to incorporate the concept of an amount balance in the context of the ready-to-order state:

```js
...
type VendingMachineManifest = {
    states: {
        'idle': NoContext, 
        'ready-to-order': {amountBalance:number},
        'dispensing': NoContext,
        'refunding': NoContext
    },
    events: {
        "coin_inserted": {insertedAmount:number},
        "item_selected" : {},
        "dispensed": {}
        "cancelled" : {},
        "refunded" : {},
    }
}
...
```
When the customer inserts money, the system transitions to the `ready-to-order` state. At this point, the context is changed to `NoContext` to `{amountBalance:number}`.

Notice that the new state context is derived from the existing state context and the event data.

```js
...
builder.atomicState('idle')
    .transition('coin_inserted', 'ready-to-order', 
        (context, event) => {
            return {amountBalance: event.insertedAmount}
        });
...
```