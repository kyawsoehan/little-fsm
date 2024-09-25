import { ConditionDescriptor, LittleEvent, Fsm, RootManifest, StateManifest, inArray, CompositeStateIOConfig, CompositeStateExitEventType } from "./Fsm";

export type NoContext = {
    context: {}
}

export function retainContext(c, e) {
    return c;
};

interface EventToTargetStateDef<SM extends RootManifest['states'], EM extends RootManifest['events'], CSC> {
    transition<E extends keyof EM, NS extends keyof SM>(eventName:E, nextState:NS, fun:(currentStateContext:CSC, eventParams:EM[E]) => SM[NS]['context']) : EventToTargetStateDef<SM, EM, CSC>
}

interface FinalSubStateToTargetStateDef<SM extends RootManifest['states'], SSA extends StateManifest['substates'], CSC> {
    transitionOnCompletion<NS extends keyof SM>(nextState:NS, fun:(currentStateContext:CSC) => SM[NS]['context']) : FinalSubStateToTargetStateDef<SM, SSA, CSC>
    transitionOnTermination<NS extends keyof SM>(nextState:NS, fun:(currentStateContext:CSC) => SM[NS]['context']) : FinalSubStateToTargetStateDef<SM, SSA, CSC>
}

interface EventToTargetSubStateDef<SM extends StateManifest['substates'], EM extends StateManifest['events'], CC> {
    //when<E extends keyof EM, N extends inArray<SM>>(items:Record<E, [N, fun:(ctx:CC, event:EM[E]) => CC]>):EventToTargetSubStateDef<SM, EM, CC>
    transition<E extends keyof EM, N extends inArray<SM>>(eventName:E, nextStateName:N, fun:(currentStateContext:CC, eventParams:EM[E]) => CC) : EventToTargetSubStateDef<SM, EM, CC>
    completion<E extends keyof EM, N extends inArray<SM>>(eventName:E, fun:(currentStateContext:CC, eventParams:EM[E]) => CC) : EventToTargetSubStateDef<SM, EM, CC>
    termination<E extends keyof EM, N extends inArray<SM>>(eventName:E, fun:(currentStateContext:CC, eventParams:EM[E]) => CC) : EventToTargetSubStateDef<SM, EM, CC>
}

export interface StateTransitionDescriptor {currState:string, event:string, nextState:string}

export interface SubStateTransitionDescriptor{
    currSubstate:string,
    eventName:string,
    nextSubstate:string,
    contextChangeFunction: (context:any, event:any) => void 
}

export interface InitialSubStateEntryConditionDescriptor {
    name:string,
    condition?:ConditionDescriptor<any>
}

export class TypedState<SM extends RootManifest['states'], S extends keyof SM> {
    constructor(public readonly name:S, public readonly data:SM[S]) {}
}

export class FsmBuilder<T extends RootManifest> {

    private stateToEventFunctionMap = new Map<string, Map<string, [string, (currStateContext:any, event:any) => any]>>();    
    private compoundStateIOMap = new Map<string, CompositeStateIOConfig>();    

    constructor() {}   

    build():Fsm<T> {
        return new Fsm(this.stateToEventFunctionMap, this.compoundStateIOMap);
    }

    simpleState<S extends keyof T['states'], CC extends T['states'][S]['context']>
        (currState:S):EventToTargetStateDef<T['states'], T['events'], CC> {     

        let stateToEventFunctionMap = this.stateToEventFunctionMap;  
        
        let objWithWhen:EventToTargetStateDef<T['states'], T['events'], CC> = {

            transition<E extends keyof T['events'], N extends keyof T['states']>(eventName:E, nextStateName:N, fun:(currentContext:CC, eventParams:T['events'][E]) => T['states'][N]['context']) {
                if(!stateToEventFunctionMap.has(currState as string)) {
                    let map = new Map<string, [string, (event) => any]>();
                    stateToEventFunctionMap.set(currState as string, map)
                }
        
                let eventToFunctionMap:Map<string, [string, (context:any, event:LittleEvent) => any]> = 
                    stateToEventFunctionMap.get(currState as string)!;
                eventToFunctionMap.set(eventName as string, [nextStateName as string, fun]); 

                return objWithWhen;
            }
        }
        return objWithWhen;
    }

    private getOrCreateCompoundStateIOConfig(compoundState:string):CompositeStateIOConfig {
        if(!this.compoundStateIOMap.has(compoundState)) {
            this.compoundStateIOMap.set(compoundState, {
                initialSubStates: [],
                completionSubStates: [],
                terminationSubStates: []
            })
        }  
        return this.compoundStateIOMap.get(compoundState)!; 
    }

    compositeState<S extends keyof T['states'] & string, CSC extends T['states'][S]['context']>
        (currState:S, subFsmBuilder:SubFsmBuilder<T['states'][S]>):FinalSubStateToTargetStateDef<T['states'],T['states'][S]['substates'], CSC> {  
        
        this.integrateSubFsmBuilder(currState, subFsmBuilder);
            
        let thisBuilder = this;
        
        let objWithWhen:FinalSubStateToTargetStateDef<T['states'], T['states'][S]['substates'], CSC> = {

            transitionOnCompletion: function <NS extends keyof T["states"]>(nextState: NS, fun: (currentStateContext: CSC) => T["states"][NS]["context"]): FinalSubStateToTargetStateDef<T["states"], T["states"][S]["substates"], CSC> {
                thisBuilder.addCompoundStateExitTransition(currState, '@completed', nextState as string, fun);
                return objWithWhen;
            },

            transitionOnTermination: function <NS extends keyof T["states"]>(nextState: NS, fun: (currentStateContext: CSC) => T["states"][NS]["context"]): FinalSubStateToTargetStateDef<T["states"], T["states"][S]["substates"], CSC> {
                thisBuilder.addCompoundStateExitTransition(currState, '@terminated', nextState as string, fun);
                return objWithWhen;
            }
        }
        return objWithWhen;
    }

    private addInitialSubstateCondition(parentState:string, descriptor:InitialSubStateEntryConditionDescriptor) {
        let compoundStateIOConfig = this.getOrCreateCompoundStateIOConfig(parentState);

        let initialSubStateKey = `${parentState}.${descriptor.name as string}`;
        let entryStateConditionDescriptor = {
            key:initialSubStateKey,
            substate: descriptor.name,
            condition: descriptor.condition
        };
        compoundStateIOConfig.initialSubStates.push(entryStateConditionDescriptor); 
    }

    private addCompletionSubstate(parentState:string, substate:string) {
        let compoundStateIOConfig = this.getOrCreateCompoundStateIOConfig(parentState);
        compoundStateIOConfig.completionSubStates.push(`${parentState}.${substate}`); 
    }

    private addTerminationSubstate(parentState:string, substate:string) {
        let compoundStateIOConfig = this.getOrCreateCompoundStateIOConfig(parentState);
        compoundStateIOConfig.terminationSubStates.push(`${parentState}.${substate}`); 
    }

    private addSubstateTransition(
        parentState:string, 
        currSubState:string, eventName:string, nextSubState:string, contextChangeFunction:(context:any, event:any) => any) {
        
        let currSubStateKey = `${parentState}.${currSubState}`;
        let nextSubStateKey = `${parentState}.${nextSubState}`;
        
        if(!this.stateToEventFunctionMap.has(currSubStateKey)) {
            let map = new Map<string, [string, (context, event) => any]>();
            this.stateToEventFunctionMap.set(currSubStateKey, map)
        }

        let eventToFunctionMap = this.stateToEventFunctionMap.get(currSubStateKey)!;

        eventToFunctionMap.set(eventName as string, [nextSubStateKey as string, contextChangeFunction]); 
    }

    private addCompoundStateExitTransition(
        parentState:string, eventName:CompositeStateExitEventType, nextState:string, contextChangeFunction:(context:any, event:any) => any) {
        
        if(!this.stateToEventFunctionMap.has(parentState)) {
            let map = new Map<string, [string, (event) => any]>();
            this.stateToEventFunctionMap.set(parentState, map)
        }

        let eventToFunctionMap:Map<string, [string, (context:any, event:any) => any]> = 
            this.stateToEventFunctionMap.get(parentState)!;
        eventToFunctionMap.set(eventName, [nextState as string, contextChangeFunction]); 
    }

    private integrateSubFsmBuilder<S extends keyof T['states'] & string, SM extends T['states'][S]>(state:S, subFsmBuilder:SubFsmBuilder<SM>) {

        subFsmBuilder.getInitialSubStateConditionDescriptors().forEach(descriptor => {
            this.addInitialSubstateCondition(state, descriptor)
        });

        //console.log("sub builder completions", state, subFsmBuilder.getCompletionSubStates());

        subFsmBuilder.getCompletionSubStates().forEach(substate => {
            this.addCompletionSubstate(state, substate)
        });

        subFsmBuilder.getTerminationSubStates().forEach(substate => {
            this.addTerminationSubstate(state, substate)
        });

        subFsmBuilder.getSubStateTransitionDescriptors().forEach(descriptor => {            
            this.addSubstateTransition(
                state as string,
                descriptor.currSubstate,
                descriptor.eventName,
                descriptor.nextSubstate,
                descriptor.contextChangeFunction
            )
        });
    }
}

export class SubFsmBuilder<SM extends StateManifest> {    

    private initialSubStateConditionDescriptors: InitialSubStateEntryConditionDescriptor[] = [];
    
    private subStateTransitionDescriptors: SubStateTransitionDescriptor[] = []; 

    private isCompletable:boolean = true;
    private isTerminatable:boolean = false;
    
    constructor() {}

    entrySubstate<SUB extends inArray<SM['substates']>, CC extends SM['context']>(initialSubstate:SUB, condition?:ConditionDescriptor<CC>) {
        this.initialSubStateConditionDescriptors.push({
            name: initialSubstate as string,
            condition: condition
        })
        return this;
    };

    substate<SUB extends inArray<SM['substates']>, CC extends SM['context']>
        (currSubstate:SUB):EventToTargetSubStateDef<SM['substates'], SM['events'], CC> {  
        
        let subStateTransitionDescriptors = this.subStateTransitionDescriptors;    
        let thisBuilder = this;
        
        let objWithWhen:EventToTargetSubStateDef<SM['substates'], SM['events'], CC> = {         
                        
            transition<E extends keyof SM['events'], N extends inArray<SM['substates']>>(eventName:E, nextSubstate:N, fun:(currentContext:CC, eventParams:SM['events'][E]) => CC) {
                subStateTransitionDescriptors.push({
                    currSubstate: currSubstate as string,
                    eventName: eventName as string,
                    nextSubstate: nextSubstate as string,
                    contextChangeFunction: fun
                });
                return objWithWhen;
            },
            completion<E extends keyof SM['events'], N extends inArray<SM['substates']>>(eventName:E, fun:(currentContext:CC, eventParams:SM['events'][E]) => CC) {
                subStateTransitionDescriptors.push({
                    currSubstate: currSubstate as string,
                    eventName: eventName as string,
                    nextSubstate: 'completion',
                    contextChangeFunction: fun
                });
                thisBuilder.isCompletable = true;
                return objWithWhen;
            },
            termination<E extends keyof SM['events'], N extends inArray<SM['substates']>>(eventName:E, fun:(currentContext:CC, eventParams:SM['events'][E]) => CC) {
                subStateTransitionDescriptors.push({
                    currSubstate: currSubstate as string,
                    eventName: eventName as string,
                    nextSubstate: 'termination',
                    contextChangeFunction: fun
                });
                thisBuilder.isTerminatable = true;
                return objWithWhen;
            }
        }
        return objWithWhen;
    }

    getInitialSubStateConditionDescriptors(): InitialSubStateEntryConditionDescriptor[] {
        return this.initialSubStateConditionDescriptors;
    }

    getSubStateTransitionDescriptors(): SubStateTransitionDescriptor[] {
        return this.subStateTransitionDescriptors;
    }

    getCompletionSubStates():string[] {
        return this.isCompletable? ['completion'] : [];
    }

    getTerminationSubStates():string[] {
        return this.isTerminatable? ['termination'] : [];
    }
}

