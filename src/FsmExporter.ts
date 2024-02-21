import { CompoundStateIOConfig, ConditionDescriptor, Fsm, LittleEvent, LittleState} from "./Fsm";

export interface StateTransitionDescriptor {currState:string, event:string, nextState:string}

export interface CompoundStateUMLNode {
    stateName:string, 
    initialSubStates:{name:string, condition?:ConditionDescriptor<any>}[],
    completionSubStates: string[],
    terminationSubStates: string[]
    transitionDescriptors:StateTransitionDescriptor[]
}

export function buildFsmExporter(fsm:Fsm<any>):FsmExporter {
    return new FsmExporter(fsm.internals().stateToEventFunctionMap, fsm.internals().compoundStateIOMap);
}

export class FsmExporter {
    constructor(
        private readonly stateToEventFunctionMap: Map<string, Map<string, [string, (currStateContext:any, event:any) => any]>>,
        private readonly compoundStateIOMap: Map<string, CompoundStateIOConfig>) {}

    getEventStateRules(): {
        transitionDescriptors:StateTransitionDescriptor[]
        compoundStates: CompoundStateUMLNode[]
    } {
        let transitionDescriptors:{currState:string, event:string, nextState:string}[] = 
            this.toTransitionDescriptors(this.stateToEventFunctionMap);
        let compoundStates:CompoundStateUMLNode[] = [];
        
        let stateToEventFunctionMap = this.stateToEventFunctionMap;
        this.compoundStateIOMap.forEach((ioConfig, compoundState) => {
            let node:CompoundStateUMLNode = {
                stateName: compoundState,
                initialSubStates: ioConfig.initialSubStates, 
                completionSubStates: ioConfig.completionSubStates, 
                terminationSubStates: ioConfig.terminationSubStates,
                transitionDescriptors: this.toTransitionDescriptors(stateToEventFunctionMap, compoundState)
            }
            compoundStates.push(node);
        });

        return {
            transitionDescriptors: transitionDescriptors,
            compoundStates: compoundStates
        };
    }

    toTransitionDescriptors(_stateToEventFunctionMap:Map<string, Map<string, [string, (stateData:any, eventData:any) => any]>>, parentState?:string):StateTransitionDescriptor[] {
        let transitionDescriptors:{currState:string, event:string, nextState:string}[] = [];
        _stateToEventFunctionMap.forEach((value: Map<string, [string, (state:LittleState, event:LittleEvent) => LittleState]>, keyCurrentState: string) => { 
            value.forEach ((value: [string, (state:LittleState, event:LittleEvent) => LittleState], keyEvent: string) => {
                
                let eventName= keyEvent;
                let nextStateName = value[0];
                let stateEventRule = {currState:keyCurrentState, event:eventName, nextState:nextStateName};

                let isRootLevel = !parentState && !nextStateName.includes(".");
                let isGroupLevelWithCorrectParent = parentState && nextStateName.includes(`${parentState}.`)
                if(isRootLevel || isGroupLevelWithCorrectParent) {
                    transitionDescriptors.push(stateEventRule);
                }
            })
        })
        return transitionDescriptors;
    }
}
