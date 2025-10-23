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
        'home_transit': {
            context: HomeContext,
            events: {
                'search_submitted': {searchCriteria:string},
                'profile_requested': {profileId:number}
            }
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
        "back" : {},
        "transitted_for_search": {searchCriteria:string},
        "transitted_for_profile": {profileId:number},
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
        .transitionOnCompletion('home_transit', c => c)

    builder.compositeState('search', buildSearchState())
    builder.compositeState('profile', buildProfileState())

    builder.simpleState('home_transit')
        .transition('transitted_for_search', 'search', (c, e) => {
            return {
                searchCriteria: c.searchCriteria!
            }
        })
        .transition('transitted_for_profile', 'profile', (c, e) => {
            return {
                profileId: c.profileId!
            }
        });

    return builder.build();
}

// This test verifies that when the "home" state completes (after a search submission), the FSM transitions to the "search" state.
test("expect transition to search when home is completed", () => {
    let fsm = buildRootState();

    // Set entry effect that simulate the conditional branching
    fsm.setEntryEffect("home_transit", c => {
        console.log("Current context:", c)
        if(c.searchCriteria) {
            fsm.processEvent("transitted_for_search", {searchCriteria: c.searchCriteria})
        } else if(c.profileId) {
            fsm.processEvent("transitted_for_profile", {profileId: c.profileId!})
        }
        console.log("Current state:", fsm.getCurrentState());
    })

    fsm.init("home", {});
    expect('home').toBe(fsm.getCurrentState());
    expect('initial').toBe(fsm.getCurrentSubState());

    fsm.processSubstateEvent("home", 'search_submitted', {searchCriteria:"yangon"});
    expect('search').toBe(fsm.getCurrentState());
});

//npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha`.ts(2582)