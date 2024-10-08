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
Check the [npm repository](https://www.npmjs.com/package/little-fsm) of little-fsm for details.

## Quick Start

Let's construct a state machine to model the state transitions in a vending machine.

- The vending machine starts in an idle state, waiting for user interaction. 
- When a customer inserts money, the machine transitions to the ready-to-order state, signaling that it is prepared to accept a selection. 
- Once the customer chooses a product, the machine enters the dispensing state, where it delivers the chosen item to the customer.
- After dispensing, the machine transitions to the refunding state, where it returns the excess amount. 
- Once the refund (if any) is complete, the machine returns to the idle state, ready for the next customer interaction.

### Fsm with empty context

```js
import { NoContext, retainContext, FsmBuilder } from "little-fsm"

type VendingMachineManifest = {
    states: {
        'idle': NoContext, 
        'ready-to-order': NoContext,
        'dispensing-item': NoContext,
        'refunding': NoContext
    },
    events: {
        "money-inserted": {},
        "item-selected" : {},
        "item-dispensed": {}
        "cancelled" : {},
        "refunded" : {},
    }
}

function buildFsm(): Fsm<VendingMachineManifest> {
    let builder = new FsmBuilder<VendingMachineManifest>();

    builder.simpleState('idle')
        .transition('money-inserted', 'ready-to-order', retainContext);

    builder.simpleState('ready-to-order')
        .transition('item-selected', 'dispensing-item', retainContext)
        .transition('cancelled', 'refunding', retainContext);

    builder.simpleState('dispensing-item')
        .transition('item-dispensed', 'refunding', retainContext);

    builder.simpleState('refunding')
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
fsm.processEvent('money-inserted', {})
```

### Fsm with the context in `ready-to-order` state

Here’s how to incorporate the concept of an amount balance in the context of the ready-to-order state:

```js
...
type VendingMachineManifest = {
    states: {
        'idle': NoContext,
        'ready-to-order': {
            context: {
                balanceAmount:number
            }
        },
        'dispensing-item': NoContext,
        'refunding': NoContext
    },
    events: {
        "money-inserted": {insertedAmount:number},
        "item-selected" : {},
        "item-dispensed": {}
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
builder.simpleState('idle')
    .transition('money-inserted', 'ready-to-order', 
        (context, event) => {
            return {amountBalance: event.insertedAmount}
        });
...
```

When inserting money while the system is already at `ready-to-order` state.
```js
builder.simpleState('ready-to-order')
    .transition('item-selected', 'dispensing-item', retainContext)
    .transition('cancelled', 'refunding', retainContext)
    .transition('money-inserted', 'ready-to-order', (ctx, event) => {
        return {
            balanceAmount: ctx.balanceAmount + event.insertedAmount
        }
    });
```
When the customer inserts money, we trigger an event to the finite state machine (FSM).
```js
fsm.processEvent('money-inserted', {
    insertedAmount: 5
})
```

You can observe the state entry into `ready-to-order` state:
```js
fsm.setEntryEffect('ready-to-order', ctx => {
    // display balance on screen
    // or play sounds to notify user of ready to order stage
    console.log("Current balance:", ctx.balanceAmount);
})
```

Example implementation of observing the entry into the `dispensing-item` state:
```js
fsm.setEntryEffect('dispensing-item', ctx => {
    // Simulating the duration of dispensing a product item.
    // In reality, you may be listening to a hardware event.
    setTimeout(() => {
        fsm.processEvent('item-dispensed')
    }, 5000); // 5 seconds
})