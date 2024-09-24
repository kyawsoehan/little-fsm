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

## Quick Start

```
type VendingMachineManifest = {
    states: {
        'idle': {
            context: {}
        },
        'ready_to_order': {
            context: {}
        },
        'dispensing': {
            context: {}
        },
        'refunding': {
            context: {}
        }
    },
    events: {
        "coin_inserted": {},
        "item_selected" : {},
        "dispensed": {}
        "cancelled" : {},
        "refunded" : {},
    }
}

let noContextChange = (c, e) => c;
let builder = new FsmBuilder<OtpFsmManifest>();
builder.atomicState('idle')
    .transition('coin_inserted', 'ready_to_order', noContextChange);

builder.atomicState('ready_to_order')
    .transition('item_selected', 'dispensing', noContextChange);
    .transition('cancelled', 'refunding', noContextChange);

builder.atomicState('dispensing')
    .transition('dispensed', 'idle', noContextChange);
builder.atomicState('refunding')
    .transition('refunded', 'idle', noContextChange);

let fsm = builder.build();
```