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
    name:string = "";
    data:any
}

export class StateDetails {
    readonly key: string;
    constructor(readonly state:string, readonly substate:string|null, readonly context:any) {
        this.key = (substate)? `${state}.${substate}` : state;
    }
}

export interface ConditionDescriptor<C> {
    description:string,
    satisfies(context:C):boolean
}


function calculateInitialSubstate(parentStateDetails:StateDetails, compoundStateIOConfig:CompoundStateIOConfig):StateDetails {    
    let parentStateName = parentStateDetails.state;
    let initialSubStateDescriptors = compoundStateIOConfig.initialSubStates;
    if(initialSubStateDescriptors.length > 0) {
        if(initialSubStateDescriptors.length == 1) {
            console.info(`There is only one inital substate. Initial substate is set to [${initialSubStateDescriptors[0].key}]`);
            let substate = initialSubStateDescriptors[0].substate;
            return new StateDetails(parentStateName, substate, parentStateDetails.context);
        } else {
            console.info("There are multiple inital substates:", initialSubStateDescriptors.map(d => d.key));
            let satisfiedInitialSubstate = initialSubStateDescriptors.find(d => {
                if(d.condition != undefined) {
                    return d.condition.satisfies(parentStateDetails.context)
                } else {
                    return false;
                }
            });

            if(satisfiedInitialSubstate) {
                console.log(`The initial substate [${satisfiedInitialSubstate.key}] satisfies the condition [${satisfiedInitialSubstate.condition?.description}]`)
                let substate = satisfiedInitialSubstate.substate;
                return new StateDetails(parentStateName, substate, parentStateDetails.context);
            } else {
                console.log(`No initial substate satisfied its specified condition. Hence the first initial substate [${initialSubStateDescriptors[0].key}] is selected`);
                // Use the first initial substates if none satisfies
                let substate = initialSubStateDescriptors[0].substate;
                return new StateDetails(parentStateName, substate, parentStateDetails.context);
            }
        }
    } else {
        throw new Error(`No initial substate is defind for the compound state ${parentStateDetails}.`);
    }
}

function parseStateKey(stateKey:string):{state:string, substate:string|null} {
    if(stateKey.includes(".")) {
        let parts:string[] = stateKey.split(".");
        return {state:parts[0], substate:parts[1]};
    } else {
        return {state:stateKey, substate:null};
    }    
}

function calculateNextState(
    currentStateDetails:StateDetails, event:LittleEvent, 
    stateEventFunctionMap:Map<string, Map<string, [string, (stateData:any, eventData:any) => any]>>): StateDetails | undefined {

    let currentStateKey = currentStateDetails.key;    
    //console.log("Getting event map for current state", currentStateDetails, "with key:", currentStateKey);
    let eventToFunctionMap = stateEventFunctionMap.get(currentStateDetails.key);
    if(eventToFunctionMap) {
        let tuple:[string, ((state:StateDetails, event:LittleEvent) => StateDetails)] | undefined = eventToFunctionMap.get(event.name);
        if(tuple != undefined) {  
            let nextStateKey = tuple[0];
            let nextStateDataFun = tuple[1];    
            if(nextStateDataFun) {
                let {state, substate} = parseStateKey(nextStateKey);
                let nextStatContext = nextStateDataFun(currentStateDetails.context, event.data);
                return new StateDetails(state, substate, nextStatContext);
            } else {
                console.error("No state context change function is defined for state=%s event=%s", currentStateDetails.state, event.name);
            }  
        } else {
            console.error("No state transition defined for state=%s event=%s", currentStateDetails.state, event.name);
        }            
    } else {
        console.error("No state transition defined for state=", currentStateDetails.state);
    }
    return undefined;
}
 
export interface SubFsm<SM extends StateManifest> {
    processEvent<E extends keyof SM['events']>(eventName:E, eventData:SM['events'][E]):void 

    getCurrentSubState<S extends inArray<SM['substates']>>():S   

    getCurrentContext<C extends SM['context']>():C

    setEnterEffect<S extends inArray<SM['substates']>, C extends SM['context']>(substate:S, effectFun:(context:C) => void):void
}

export interface CompoundStateIOConfig {
    initialSubStates: {key:string, substate:string, condition?:ConditionDescriptor<any>}[],
    completionSubStates: string[],
    terminationSubStates: string[]
}

export class Fsm<T extends RootManifest> {

    private currentStateDetails: StateDetails|null = null;   

    private onStateEntrySideEffectMap = new Map<string, (state:StateDetails) => void>();
    private onStateExitSideEffectMap = new Map<string, (state:StateDetails) => void>();

    private stateChangeEffect:(oldStateDetails:StateDetails|null, newStateDetais:StateDetails, eventName?:string) => void = () => {};

    constructor(
        private readonly stateToEventFunctionMap: Map<string, Map<string, [string, (currStateContext:any, event:any) => any]>>,
        private readonly compoundStateIOMap: Map<string, CompoundStateIOConfig>) {}

    internals() {
        return {
            stateToEventFunctionMap: this.stateToEventFunctionMap,
            compoundStateIOMap: this.compoundStateIOMap
        }
    }

    init<S extends keyof T['states'] & string>(currStateName:S, stateContext:T['states'][S]['context']) {
        this.currentStateDetails = new StateDetails(currStateName, null, stateContext);
        if(this.compoundStateIOMap.has(this.currentStateDetails.state)) {
            let newState = calculateInitialSubstate(this.currentStateDetails, this.compoundStateIOMap.get(this.currentStateDetails.state)!)
            //console.log("Calculated initial substate", newState);
            this.currentStateDetails = newState;
        } 
        this.stateChangeEffect(null, this.currentStateDetails);       
    }

    getCurrentState<S extends keyof T['states'], C extends T['states'][S]['context']>(): S {
        if(this.currentStateDetails == null) {
            throw new Error("Initial state is not defined.");
        } 
        return this.currentStateDetails.state as S;
    }

    getCurrentStateContext<S extends keyof T['states'], C extends T['states'][S]['context']>(state:S): C {
        if(this.currentStateDetails == null) {
            throw new Error("Initial state is not defined.");
        } 
        return this.currentStateDetails.context as C
    }

    setStateChangeEffect(effect:(oldStateDetais:StateDetails, newStateDetails:StateDetails, eventName?:string) => void) {
        this.stateChangeEffect = effect;
    }
    
    setEntryEffect<SN extends keyof T['states']>(stateName:SN, onEnterEffect:(stateData:T['states'][SN]['context']) => void) {
        this.onStateEntrySideEffectMap.set(stateName as string, onEnterEffect);
    }

    setExitEffect<SN extends keyof T['states']>(stateName:SN, onEnterEffect:(stateData:T['states'][SN]['context']) => void) {
        this.onStateExitSideEffectMap.set(stateName as string, onEnterEffect);
    }

    setSubstateEntryEffect<SN extends keyof T['states'], SSN extends keyof T['states'][SN]['substates']>(stateName:SN, substateName:SSN, onEnterEffect:(stateData:T['states'][SN]['context']) => void) {
        let itemKey = `${stateName as string}.${substateName as string}`;
        this.onStateEntrySideEffectMap.set(itemKey, onEnterEffect);
    }

    setSubstateExitEffect<SN extends keyof T['states'], SSN extends keyof T['states'][SN]['substates']>(stateName:SN, substateName:SSN, onEnterEffect:(stateData:T['states'][SN]['context']) => void) {
        let itemKey = `${stateName as string}.${substateName as string}`;
        this.onStateExitSideEffectMap.set(itemKey, onEnterEffect);
    }

    private logStateTransition(currState:StateDetails, event:LittleEvent, newState?:StateDetails) {        
        console.table({
            "current state": currState.key,
            "event": event.name,
            "new state": newState?.key
        });
    }

    private executeOnEnterEffect(stateDetails:StateDetails) {
        let itemKey = stateDetails.key;

        let onStateEnterEffectFun = this.onStateEntrySideEffectMap.get(itemKey);
        if(onStateEnterEffectFun) {
            console.debug("Executing OnEnterEffect for state=%s ...", stateDetails.key);
            onStateEnterEffectFun(stateDetails.context);
            console.debug("Executed OnEnterEffect for state=%s", stateDetails.key);
        }
    }
    
    private exitCompoundState(state:string, eventName:CompoundStateExitEventType) {
        let currentCompoundStateDetails = new StateDetails(state, null, this.currentStateDetails!.context);
        
        let event:LittleEvent = {
            name: eventName,
            data: {}
        };
        let newStateDetails = calculateNextState(currentCompoundStateDetails, event, this.stateToEventFunctionMap);
        if(newStateDetails) {
            if(this.compoundStateIOMap.has(newStateDetails.state)) {
                newStateDetails = calculateInitialSubstate(newStateDetails, this.compoundStateIOMap.get(newStateDetails.state)!)
            }
            this.logStateTransition(currentCompoundStateDetails, event, newStateDetails);  
            this.currentStateDetails = newStateDetails;
        } else {
            console.warn("New state cannot be calculated.");
            this.logStateTransition(currentCompoundStateDetails, event);    
        }  
    }

    processEvent<E extends keyof T['events']>(eventName:E, eventData:T['events'][E]) {
        if(this.currentStateDetails == null) {
            console.error("Initial state is not defined.");
            return;
        } 

        let event:LittleEvent = {
            name: eventName as string,
            data: eventData
        };

        console.debug("Processing [event:%s] on current [state:%s]", event.name, this.currentStateDetails.state);        
        let newStateDetails = calculateNextState(this.currentStateDetails, event, this.stateToEventFunctionMap);        
        if(newStateDetails) { 
            if(this.compoundStateIOMap.has(newStateDetails.state)) {
                newStateDetails = calculateInitialSubstate(newStateDetails, this.compoundStateIOMap.get(newStateDetails.state)!)
            }
            this.logStateTransition(this.currentStateDetails, event, newStateDetails);  
            this.stateChangeEffect(this.currentStateDetails, newStateDetails, eventName as string);
            this.currentStateDetails = newStateDetails;
            this.executeOnEnterEffect(this.currentStateDetails);
        } else {
            console.warn("New state cannot be calculated.");
            this.logStateTransition(this.currentStateDetails, event);    
        }        
    }

    processSubstateEvent<S extends keyof T['states'], E extends keyof T['states'][S]['events']>(state:S, eventName:E, eventData:T['states'][S]['events'][E]) {
        if(this.currentStateDetails == null) {
            console.error("Initial state is not defined.");
            return;
        } 

        let oldStateDetails = this.currentStateDetails;

        let event:LittleEvent = {
            name: eventName as string,
            data: eventData
        };

        console.debug(`Processing [event:${event.name}] on [state:${this.currentStateDetails.key}]`);            
        let newStateDetails = calculateNextState(this.currentStateDetails, event, this.stateToEventFunctionMap);        
        if(newStateDetails) {   
            this.logStateTransition(this.currentStateDetails, event, newStateDetails);    
            this.currentStateDetails = newStateDetails;                        

            //TODO handle compound state exit
            if(this.compoundStateIOMap.has(state as string)) {
                this.compoundStateIOMap.get(state as string)?.completionSubStates.forEach(finalSubStateKey => {
                    if(finalSubStateKey == newStateDetails?.key) {
                        console.log("Reached the final completion state: ", finalSubStateKey);                        
                        this.exitCompoundState(state as string, '@completed');
                    }
                })

                this.compoundStateIOMap.get(state as string)?.terminationSubStates.forEach(finalSubStateKey => {
                    if(finalSubStateKey == newStateDetails?.key) {
                        console.log("Reached the final completion state: ", finalSubStateKey);                        
                        this.exitCompoundState(state as string, '@terminated');
                    }
                })
            }
            this.stateChangeEffect(oldStateDetails, this.currentStateDetails, eventName as string);
            this.executeOnEnterEffect(this.currentStateDetails);
        } else {
            console.warn("New state cannot be calculated.");
            this.logStateTransition(this.currentStateDetails, event);    
        }        
    }

    subFsm<S extends keyof T['states']>(state:S):SubFsm<T['states'][S]> {
        let thisFsm = this;
        return {
            processEvent<E extends keyof T['states'][S]['events']>(eventName:E, eventData:T['states'][S]['events'][E]) {
                thisFsm.processSubstateEvent(state, eventName, eventData);
            },

            getCurrentSubState<SUB extends inArray<T['states'][S]['substates']>>():SUB {
                //console.log("Getting current sub state", thisFsm.currentStateDetails);
                return thisFsm.currentStateDetails?.substate as SUB;
            },

            getCurrentContext<C extends T['states'][S]['context']>():C {                
                return thisFsm.getCurrentStateContext(thisFsm.getCurrentState());
            },

            setEnterEffect<SS extends inArray<T['states'][S]['substates']>, C extends T['states'][S]['context']>(substate:SS, effectFun:(context:C) => void):void {
                thisFsm.onStateEntrySideEffectMap.set(`${state as string}.${substate as string}`, effectFun);    
            }
        }  
    }
    
    isBackAllowed():boolean {
        if(this.currentStateDetails != null) {
            if(this.stateToEventFunctionMap.has(this.currentStateDetails.key)) {
                let eventToNextStateMap = this.stateToEventFunctionMap.get(this.currentStateDetails.key);
                if(eventToNextStateMap != null) {
                    return eventToNextStateMap.has('back');
                }
            }
        }
        return false;
    }
    
}


