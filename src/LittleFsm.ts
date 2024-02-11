
export type StateBoundary = {
    states:{
        [key: string]: any;
    },
    events:{
        [key: string]: any;
    },
    compounds: {
        [key: string]: SubStateBoundary;
    }
}

export type SubStateBoundary = {
    substates:{
        [key: string]: {isEntry?:boolean};
    },
    events:{
        [key: string]: any;
    },
}

class LittleEvent {
    name:string;
    data:any
}

interface LittleState {
    name:string;
    data:any; 
    parent?:LittleState
}

interface EventToTargetStateDef<SM extends StateBoundary['states'], EM extends StateBoundary['events'], CC> {
    when<E extends keyof EM, N extends keyof SM>(eventName:E, nextStateName:N, fun:(currentStateContext:CC, eventParams:EM[E]) => SM[N]) : EventToTargetStateDef<SM, EM, CC>
}

interface EventToTargetSubStateDef<SM extends SubStateBoundary['substates'], EM extends SubStateBoundary['events'], CC> {
    when<E extends keyof EM, N extends keyof SM>(eventName:E, nextStateName:N, fun:(currentStateContext:CC, eventParams:EM[E]) => CC) : EventToTargetSubStateDef<SM, EM, CC>
}

export interface StateTransitionDescriptor {currState:string, event:string, nextState:string}


export class TypedState<SM extends StateBoundary['states'], S extends keyof SM> {
    constructor(public readonly name:S, public readonly data:SM[S]) {}
}

function calculateNextState(
    currentState:LittleState, event:LittleEvent, 
    stateEventFunctionMap:Map<string, Map<string, [string, (stateData:any, eventData:any) => any]>>): LittleState | undefined {
    
    let eventToFunctionMap = stateEventFunctionMap.get(currentState.name);
    if(eventToFunctionMap) {
        let tuple:[string, ((state:LittleState, event:LittleEvent) => LittleState)] | undefined = eventToFunctionMap.get(event.name);
        if(tuple != undefined) {  
            let nextStateName = tuple[0];
            let nextStateDataFun = tuple[1];              
            let nextStateData = nextStateDataFun(currentState.data, event.data);
            return {
                name: nextStateName,
                data: nextStateData
            }
        } else {
            console.error("No state transition function exists for state=%s event=%s", currentState.name, event.name);
        }            
    } else {
        console.error("No state transition exists for state=", currentState.name);
    }
    return undefined;
}

export class LittleFsm<T extends StateBoundary> {

    private currentState: LittleState|null = null;
    private stateToEventFunctionMap = new Map<string, Map<string, [string, (stateData:any, eventData:any) => any]>>();
    private stateToSubStateToEventFunctionMap = new Map<string, Map<string, Map<string, [string, (stateData:any, eventData:any) => any]>>>();
    
    private onStateEntrySideEffectMap = new Map<string, (state:LittleState) => void>();
    private onStateExitSideEffectMap = new Map<string, (state:LittleState) => void>();

    constructor() {}

    init<S extends keyof T['states']>(currStateName:S, stateData:T['states'][S]) {
        this.currentState = {
            name: currStateName as string,
            data: stateData
        }
    }

    given<S extends keyof T['states'], CC extends T['states'][S]>
        (currState:S):EventToTargetStateDef<T['states'], T['events'], CC> {     

        let stateToEventFunctionMap = this.stateToEventFunctionMap;  
        
        let objWithWhen:EventToTargetStateDef<T['states'], T['events'], CC> = {
            when<E extends keyof T['events'], N extends keyof T['states']>(eventName:E, nextStateName:N, fun:(currentContext:CC, eventParams:T['events'][E]) => T['states'][N]) {
                if(!stateToEventFunctionMap.has(currState as string)) {
                    let map = new Map<string, [string, (event) => any]>();
                    stateToEventFunctionMap.set(currState as string, map)
                }
        
                let eventToFunctionMap:Map<string, [string, (state:LittleState, event:LittleEvent) => LittleState]> = 
                    stateToEventFunctionMap.get(currState as string)!;
                eventToFunctionMap.set(eventName as string, [nextStateName as string, fun]); 

                return objWithWhen;
            }
        }
        return objWithWhen;
    }

    givenSubstate<S extends keyof T['states'], SUB extends keyof T['compounds'][S]['substates'], CC extends T['states'][S]>
        (state:S, substate:SUB):EventToTargetSubStateDef<T['compounds'][S]['substates'], T['compounds'][S]['events'], CC> {  
                    
        if(!this.stateToSubStateToEventFunctionMap.has(state as string)) {
            let map = new Map<string, Map<string, [string, (event) => any]>>();
            this.stateToSubStateToEventFunctionMap.set(state as string, map);
        } 

        let stateToEventFunctionMap = this.stateToSubStateToEventFunctionMap.get(state as string)!;
        
        let objWithWhen:EventToTargetSubStateDef<T['compounds'][S]['substates'], T['compounds'][S]['events'], CC> = {
            when<E extends keyof T['compounds'][S]['events'], N extends keyof T['compounds'][S]['substates']>(eventName:E, nextStateName:N, fun:(currentContext:CC, eventParams:T['events'][E]) => CC) {
                let stateKey = `${substate as string}`;
                
                if(!stateToEventFunctionMap.has(stateKey)) {
                    let map = new Map<string, [string, (event) => any]>();
                    stateToEventFunctionMap.set(stateKey, map)
                }
        
                let eventToFunctionMap:Map<string, [string, (state:LittleState, event:LittleEvent) => LittleState]> = 
                    stateToEventFunctionMap.get(stateKey)!;
                eventToFunctionMap.set(eventName as string, [nextStateName as string, fun]); 

                return objWithWhen;
            }
        }
        return objWithWhen;
    }

    getCurrentState<S extends keyof T['states']>():TypedState<T['states'], S> {
        if(this.currentState == null) {
            throw new Error("Initial state is not defined.");
        } 
        return new TypedState<T['states'], S>(this.currentState.name as S, this.currentState.data);
    }

    getCurrentStateData<S extends keyof T['states']>(name:S):T['states'][S] {
        if(this.currentState == null) {
            throw new Error("Initial state is not defined.");
        } 
        return this.currentState.data as T['states'][S];
    }

    setEntryEffect<SN extends keyof T['states']>(stateName:SN, onEnterEffect:(stateData:T['states'][SN]) => void) {
        this.onStateEntrySideEffectMap.set(stateName as string, onEnterEffect);
    }

    setExitEffect<SN extends keyof T['states']>(stateName:SN, onEnterEffect:(stateData:T['states'][SN]) => void) {
        this.onStateExitSideEffectMap.set(stateName as string, onEnterEffect);
    }

    setSubstateEntryEffect<SN extends keyof T['states'], SSN extends keyof T['compounds'][SN]['substates']>(stateName:SN, substateName:SSN, onEnterEffect:(stateData:T['states'][SN]) => void) {
        let itemKey = `${stateName as string}__${substateName as string}`;
        this.onStateEntrySideEffectMap.set(itemKey, onEnterEffect);
    }

    setSubstateExitEffect<SN extends keyof T['states'], SSN extends keyof T['compounds'][SN]['substates']>(stateName:SN, substateName:SSN, onEnterEffect:(stateData:T['states'][SN]) => void) {
        let itemKey = `${stateName as string}__${substateName as string}`;
        this.onStateExitSideEffectMap.set(itemKey, onEnterEffect);
    }

    getEventStateRules(): {
        transitionDescriptors:StateTransitionDescriptor[]
        compoundStates: {stateName:string, transitionDescriptors:StateTransitionDescriptor[]}[]
    } {
        let transitionDescriptors:{currState:string, event:string, nextState:string}[] = 
            this.toTransitionDescriptors(this.stateToEventFunctionMap);
        let compoundStates:{stateName:string, transitionDescriptors:StateTransitionDescriptor[]}[] = [];
        
        this.stateToSubStateToEventFunctionMap.forEach((substateToSubEventFunctionMap, parentState) => {
            let compoundState:{stateName:string, transitionDescriptors:StateTransitionDescriptor[]} = {
                stateName: parentState,
                transitionDescriptors: this.toTransitionDescriptors(substateToSubEventFunctionMap)
            }
            compoundStates.push(compoundState);
        })

        return {
            transitionDescriptors: transitionDescriptors,
            compoundStates: compoundStates
        };
    }

    toTransitionDescriptors(_stateToEventFunctionMap:Map<string, Map<string, [string, (stateData:any, eventData:any) => any]>>):StateTransitionDescriptor[] {
        let transitionDescriptors:{currState:string, event:string, nextState:string}[] = [];
        _stateToEventFunctionMap.forEach((value: Map<string, [string, (state:LittleState, event:LittleEvent) => LittleState]>, keyCurrentState: string) => { 
            value.forEach ((value: [string, (state:LittleState, event:LittleEvent) => LittleState], keyEvent: string) => {
                let eventName= keyEvent;
                let nextStateName = value[0];
                let stateEventRule = {currState:keyCurrentState, event:eventName, nextState:nextStateName};
                transitionDescriptors.push(stateEventRule);
            })
        })
        return transitionDescriptors;
    }

    private logStateTransition(currState:LittleState, event:LittleEvent, newState?:LittleState) {        
        console.table({
            "current state": currState.name,
            "event": event.name,
            "new state": newState?.name
        });
    }

    private executeOnEnterEffect(state:LittleState) {
        let itemKey = (state.parent)? `${state.parent.name}__${state.name}` : state.name;

        let onStateEnterEffectFun = this.onStateEntrySideEffectMap.get(itemKey);
        if(onStateEnterEffectFun) {
            console.debug("Executing OnEnterEffect for state=%s ...", state.name);
            onStateEnterEffectFun(state.data);
            console.debug("Executed OnEnterEffect for state=%s", state.name);
        }
    }

    processEvent<E extends keyof T['events']>(eventName:E, eventData:T['events'][E]) {
        if(this.currentState == null) {
            console.error("Initial state is not defined.");
            return;
        } 

        let event:LittleEvent = {
            name: eventName as string,
            data: eventData
        };

        console.debug("Processing dispatch event=%s currState=%s", event.name, this.currentState.name);        
        let newState = calculateNextState(this.currentState, event, this.stateToEventFunctionMap);        
        if(newState) {   
            this.logStateTransition(this.currentState, event, newState);    
            this.currentState = newState;            
            this.executeOnEnterEffect(this.currentState);
        } else {
            console.warn("New state cannot be calculated.");
            this.logStateTransition(this.currentState, event);    
        }        
    }

    processSubstateEvent<S extends keyof T['states'], E extends keyof T['compounds'][S]['events']>(state:S, eventName:E, eventData:T['compounds'][S]['events'][E]) {
        if(this.currentState == null) {
            console.error("Initial state is not defined.");
            return;
        } 

        let event:LittleEvent = {
            name: eventName as string,
            data: eventData
        };

        console.debug("Processing dispatch event=%s currState=%s", event.name, this.currentState.name);        
        let newState = calculateNextState(this.currentState, event, this.stateToSubStateToEventFunctionMap.get(this.currentState.name)!);        
        if(newState) {   
            this.logStateTransition(this.currentState, event, newState);    
            this.currentState = newState;            
            this.executeOnEnterEffect(this.currentState);
        } else {
            console.warn("New state cannot be calculated.");
            this.logStateTransition(this.currentState, event);    
        }        
    }

    start() {
        if(this.currentState == null) {
            throw new Error("Initial state is not defined.");
        } 
        this.executeOnEnterEffect(this.currentState);
    }
}
