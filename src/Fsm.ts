export type StateType = 'INITIAL' | 'INTERNAL' | 'FINAL';

export type CompoundStateExitEventType = "@completed" | "@terminated"

export type inArray<T> = T[keyof T];

export interface StateManifest {
    context:any,
    substates?: string[],
    events?:{
        [key: string]: any;
    }
}

export type RootManifest = {
    states:{
        [key: string]: StateManifest;
    },
    events:{
        [key: string]: any;
    }
}

export class LittleEvent {
    name:string;
    data:any
}

export interface LittleState {
    name:string;
    data:any; 
    parentName?:string
}

export interface ConditionDescriptor<C> {
    description:string,
    satisfies(context:C):boolean
}

export class TypedState<SM extends RootManifest['states'], S extends keyof SM> {
    constructor(public readonly name:S, public readonly data:SM[S]) {}
}

function calculateNextState(
    currentState:LittleState, event:LittleEvent, 
    stateEventFunctionMap:Map<string, Map<string, [string, (stateData:any, eventData:any) => any]>>): LittleState | undefined {

    let currentStateKey = (currentState.parentName)? `${currentState.parentName}.${currentState.name}` : currentState.name;    
    console.log("Getting event map for current state", currentState, "with key:", currentStateKey);
    let eventToFunctionMap = stateEventFunctionMap.get(currentState.name);
    if(eventToFunctionMap) {
        let tuple:[string, ((state:LittleState, event:LittleEvent) => LittleState)] | undefined = eventToFunctionMap.get(event.name);
        if(tuple != undefined) {  
            let nextStateName = tuple[0];
            let nextStateDataFun = tuple[1];    
            if(nextStateDataFun) {
                let nextStateData = nextStateDataFun(currentState.data, event.data);
                return {
                    name: nextStateName,
                    data: nextStateData
                }
            } else {
                console.error("No state context change function is defined for state=%s event=%s", currentState.name, event.name);
            }  
        } else {
            console.error("No state transition defined for state=%s event=%s", currentState.name, event.name);
        }            
    } else {
        console.error("No state transition defined for state=", currentState.name);
    }
    return undefined;
}

export interface SubFsm<SM extends StateManifest> {
    processEvent<E extends keyof SM['events']>(eventName:E, eventData:SM['events'][E]):void 

    getCurrentSubState<S extends inArray<SM['substates']>>():S   

    getCurrentContext<C extends SM['context']>():C
}

export interface CompoundStateIOConfig {
    initialSubStates: {name:string, condition?:ConditionDescriptor<any>}[],
    completionSubStates: string[],
    terminationSubStates: string[]
}

export class Fsm<T extends RootManifest> {

    private currentState: LittleState|null = null;   

    private onStateEntrySideEffectMap = new Map<string, (state:LittleState) => void>();
    private onStateExitSideEffectMap = new Map<string, (state:LittleState) => void>();

    constructor(
        private readonly stateToEventFunctionMap: Map<string, Map<string, [string, (currStateContext:any, event:any) => any]>>,
        private readonly compoundStateIOMap: Map<string, CompoundStateIOConfig>) {}

    internals() {
        return {
            stateToEventFunctionMap: this.stateToEventFunctionMap,
            compoundStateIOMap: this.compoundStateIOMap
        }
    }

    init<S extends keyof T['states']>(currStateName:S, stateContext:T['states'][S]['context']) {
        this.currentState = {
            name: currStateName as string,
            data: stateContext
        }
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

    setEntryEffect<SN extends keyof T['states']>(stateName:SN, onEnterEffect:(stateData:T['states'][SN]['context']) => void) {
        this.onStateEntrySideEffectMap.set(stateName as string, onEnterEffect);
    }

    setExitEffect<SN extends keyof T['states']>(stateName:SN, onEnterEffect:(stateData:T['states'][SN]['context']) => void) {
        this.onStateExitSideEffectMap.set(stateName as string, onEnterEffect);
    }

    setSubstateEntryEffect<SN extends keyof T['states'], SSN extends keyof T['states'][SN]['substates']>(stateName:SN, substateName:SSN, onEnterEffect:(stateData:T['states'][SN]['context']) => void) {
        let itemKey = `${stateName as string}__${substateName as string}`;
        this.onStateEntrySideEffectMap.set(itemKey, onEnterEffect);
    }

    setSubstateExitEffect<SN extends keyof T['states'], SSN extends keyof T['states'][SN]['substates']>(stateName:SN, substateName:SSN, onEnterEffect:(stateData:T['states'][SN]['context']) => void) {
        let itemKey = `${stateName as string}__${substateName as string}`;
        this.onStateExitSideEffectMap.set(itemKey, onEnterEffect);
    }

    private logStateTransition(currState:LittleState, event:LittleEvent, newState?:LittleState) {        
        console.table({
            "current state": currState.name,
            "event": event.name,
            "new state": newState?.name
        });
    }

    private executeOnEnterEffect(state:LittleState) {
        let itemKey = (state.parentName)? `${state.parentName}__${state.name}` : state.name;

        let onStateEnterEffectFun = this.onStateEntrySideEffectMap.get(itemKey);
        if(onStateEnterEffectFun) {
            console.debug("Executing OnEnterEffect for state=%s ...", state.name);
            onStateEnterEffectFun(state.data);
            console.debug("Executed OnEnterEffect for state=%s", state.name);
        }
    }
    
    private exitCompoundState(state:string, eventName:CompoundStateExitEventType) {
        let currentCompoundState:LittleState = {
            name: state,
            data: this.currentState!.data 
        }
        let event:LittleEvent = {
            name: eventName,
            data: {}
        };
        let newState = calculateNextState(currentCompoundState, event, this.stateToEventFunctionMap);
        if(newState) {
            this.enterNewState(newState, event); 
        } else {
            console.warn("New state cannot be calculated.");
            this.logStateTransition(currentCompoundState, event);    
        }  
    }

    private enterNewState(newState:LittleState, event:LittleEvent) {
        if(this.currentState == null) {
            console.error("Initial state is not defined.");
            return;
        } 

        // handle compound state entry  
        if(this.compoundStateIOMap.has(newState.name)) {
            console.info(`Entering the new compound state [${newState.name}]. Calculating the inital substate...`)

            let parentStateName = newState.name;
            let initialSubStateDescriptors = this.compoundStateIOMap.get(newState.name)?.initialSubStates!;
            if(initialSubStateDescriptors.length == 1) {
                console.info(`There is only one inital substate. Initial substate is set to [${initialSubStateDescriptors[0].name}]`);
                newState = {
                    name:initialSubStateDescriptors[0].name,
                    parentName:parentStateName,
                    data: newState.data
                }                
            } else if(initialSubStateDescriptors.length > 1) {
                console.info("There are multiple inital substates:", initialSubStateDescriptors.map(d => d.name));
                let satisfiedInitialSubstate = initialSubStateDescriptors.find(d => {
                    if(d.condition != undefined) {
                        return d.condition.satisfies(newState.data)
                    } else {
                        return false;
                    }
                });

                if(satisfiedInitialSubstate) {
                    console.log(`The initial substate [${satisfiedInitialSubstate.name}] satisfies the condition [${satisfiedInitialSubstate.condition?.description}]`)
                    newState = {
                        name:satisfiedInitialSubstate.name,
                        parentName:parentStateName,
                        data: newState.data
                    }
                } else {
                    console.log(`No initial substate satisfied its specified condition. Hence the first initil substate [${initialSubStateDescriptors[0].name}] is selected`);
                    // Use the first initial substates if none satisfies
                    newState = {
                        name:initialSubStateDescriptors[0].name,
                        parentName:parentStateName,
                        data: newState.data
                    }
                }
            }
        }

        this.logStateTransition(this.currentState, event, newState);    
        this.currentState = newState;            
        this.executeOnEnterEffect(this.currentState);
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
            this.enterNewState(newState, event);
        } else {
            console.warn("New state cannot be calculated.");
            this.logStateTransition(this.currentState, event);    
        }        
    }

    processSubstateEvent<S extends keyof T['states'], E extends keyof T['states'][S]['events']>(state:S, eventName:E, eventData:T['states'][S]['events'][E]) {
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

            //TODO handle compound state exit
            if(this.compoundStateIOMap.has(state as string)) {
                this.compoundStateIOMap.get(state as string)?.completionSubStates.forEach(finalSubState => {
                    if(finalSubState == newState?.name) {
                        console.log("Reached the final completion state: ", finalSubState);                        
                        this.exitCompoundState(state as string, '@completed');
                    }
                })

                this.compoundStateIOMap.get(state as string)?.terminationSubStates.forEach(finalSubState => {
                    if(finalSubState == newState?.name) {
                        console.log("Reached the final completion state: ", finalSubState);                        
                        this.exitCompoundState(state as string, '@terminated');
                    }
                })
            }
        } else {
            console.warn("New state cannot be calculated.");
            this.logStateTransition(this.currentState, event);    
        }        
    }

    subFsm<S extends keyof T['states']>(state:S):SubFsm<T['states'][S]> {
        let thisFsm = this;
        return {
            processEvent<E extends keyof T['states'][S]['events']>(eventName:E, eventData:T['states'][S]['events'][E]) {
                thisFsm.processSubstateEvent(state, eventName, eventData);
            },

            getCurrentSubState<SUB extends inArray<T['states'][S]['substates']>>():SUB {
                return thisFsm.getCurrentState().name as SUB;
            },

            getCurrentContext<C extends T['states'][S]['context']>():C {
                return thisFsm.getCurrentState().data.context as C;
            }
        }  
    }

    start() {
        if(this.currentState == null) {
            throw new Error("Initial state is not defined.");
        } 
        this.executeOnEnterEffect(this.currentState);
    }
}


