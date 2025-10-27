import { Fsm } from "../../src/Fsm"
import { FsmBuilder, SubFsmBuilder } from "../../src/FsmBuilder"
import { expect, test } from 'vitest'

type HomeContext = {
    profileId?: number,
    searchCriteria?: string
}

type RootFsmScheme = {
    states: {
        'home': {
            context:  HomeContext,
            substates: ['initial', 'selecting_location'],
            events: {        
                'search_submitted': {searchCriteria:string},
                'profile_requested': {profileId:number}
            }
        },
        'choice-after-home': {
            context: HomeContext
        },
        'profile': {
            context: {profileId:number},
            substates: ['loading_profile', "showing_profile"],
            events: {        
                'profile_ready': {}
            }
        },
        'search': {
            context: {searchCriteria:string},
            substates: ['loading_results', 'showing_results'],
            events: {        
                'results_ready': {}
            }
        }
    },
    events: {
        "back" : {}
    }
}

function buildHomeState() : SubFsmBuilder<RootFsmScheme['states']['home']> {
    let subBuilder = new SubFsmBuilder<RootFsmScheme['states']['home']>();     
    subBuilder.entrySubstate('initial');
    subBuilder.substate('initial')
        .completion('profile_requested', (c, e) => {
            return {
                profileId: e.profileId
            }
        })
        .completion('search_submitted', (c, e) => {
            return {
                searchCriteria: e.searchCriteria
            }
        });        
    return subBuilder;
}

function buildProfileState() : SubFsmBuilder<RootFsmScheme['states']['profile']> {
    let subBuilder = new SubFsmBuilder<RootFsmScheme['states']['profile']>();     
    subBuilder.entrySubstate('loading_profile');     
    return subBuilder;
}

function buildSearchState() : SubFsmBuilder<RootFsmScheme['states']['search']> {
    let subBuilder = new SubFsmBuilder<RootFsmScheme['states']['search']>();     
    subBuilder.entrySubstate('loading_results');

    return subBuilder;
}

function buildRootState(): Fsm<RootFsmScheme> {
    let builder = new FsmBuilder<RootFsmScheme>();

    builder.compositeState('home', buildHomeState())
        .transitionOnCompletion('choice-after-home', c => c);

    builder.compositeState('search', buildSearchState());

    // Setup choice state that transitions based on the conditions
    builder.choiceState('choice-after-home')
        .transition(c => c.searchCriteria != null, 'search', (c) => {
            return {
                searchCriteria: c.searchCriteria!
            };
        })
        .transition(c => c.profileId != null, 'profile', (c) => {
            return {
                profileId: c.profileId!
            };
        })


    return builder.build();
}


test("expect transition to search when home is completed with search request", () => {
    let fsm = buildRootState();   

    fsm.subFsm("home").setEnterEffect("initial", ctx => {
        console.error("Reach entry effect for home:initial.");
    })
    
    fsm.subFsm("search").setEnterEffect("loading_results", ctx => {
        console.error("Reach entry effect for search:loading_results.");
    })

    fsm.init("home", {});
    expect('home').toBe(fsm.getCurrentState());
    expect('initial').toBe(fsm.getCurrentSubState());

    fsm.processSubstateEvent("home", 'search_submitted', {searchCriteria:"yangon"});
    expect('search').toBe(fsm.getCurrentState());
});

/*
test("expect transition to profile when home is completed with profile request", () => {
    let fsm = buildRootState();    

    fsm.init("home", {});
    expect('home').toBe(fsm.getCurrentState());
    expect('initial').toBe(fsm.getCurrentSubState());

    fsm.processSubstateEvent("home", 'profile_requested', {profileId:1});
    expect('profile').toBe(fsm.getCurrentState());
});*/
