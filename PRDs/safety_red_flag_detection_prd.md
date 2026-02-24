# Team 5 PRD

## Overview

A document analysis system that evaluates uploaded documents for risk, urgency, legitimacy, and provides actionable next steps.

## Goals

- Help users assess document importance and validity
- Provide clear categorization with confidence scores
    - Flag specific key terms
    - Categories: medical, financial, housing
    - Severity level: low, medium, high, urgent
        - The date affects the urgency (overdue)
    - Risk level: how likely is this a scam
- Guide users toward appropriate next actions
    - Add links for relevant resources that are classified as medical, financial, housing
    - Ask other teams for summarization so we can use it for flagging

## User Stories

- As a non-native English speaker, I want to upload documents and receive clear assessments so I can understand their importance and required actions.
- As someone with reading difficulties, I want the system to categorize documents and suggest next steps so I can make informed decisions.

## Functional Requirements

- FR-1: Given a user uploads a document, when the system processes it, then it returns a document category with confidence score and suggested next steps.

## Non-goals

- Real-time document processing
- Multi-language support beyond English (includes speech to text and text to speech)
- Document editing capabilities

## Non-Functional Requirements

- NFR-1: System must process documents and return results within 30 seconds for 95% of requests; TBD (might be affected by the latency of other models)

## Acceptance Criteria

- Given a user uploads a document, when the system processes it, then it returns:
- Document category (risk, urgency, legitimacy)
- Confidence score (0-100%)
    - Classes for each flag with corresponding confidence score
- Suggested next steps
    - Resource bank based on class (websites, phone numbers, etc.)

## Success Metrics

- 90% user satisfaction rate- for future use
- 85% accuracy in document categorization- measuring how well the model performs
- Average processing time under 30 seconds- TBD under ‘Non-Functional Requirements’

## Open Questions / Assumptions

- What document formats will be supported?- related to Team 1; we’ll intake docs from Team 1 in JSON
- How will user privacy be handled?
- What confidence threshold is acceptable for automated decisions?

## Tasks

0.0 Use current PR branch

1.0 General routing- Aidan

- Create API route
- Set up Convex engine
- API Route: /api/safety/analyze
- Convex Function: processSafetyCheck()
- Talk to:
    - Team 1- for document ingestion

2.0 Analysis Model (LLM or ML classifier) Setup- Godwin

- Set up LLM (model), use PFT
- Choose dataset
- Implement risk assessment algorithm
- Add urgency detection
- Create legitimacy verification
- Document type classification
- Risk pattern recognition
- Rule Engine (confidence thresholds + heuristics) (Justin)
- Model Output:
    - Urgency
    - Legitimacy- scam
    - Category- medical, legal, financial, housing, etc.
    - Next steps
- Talk to:
    - Team 4- pass model analysis output for translation
    - Team 2- pass on for summary

3.0 Develop confidence scoring system- Justin

- Define scoring criteria
- Implement confidence calculation
- Add confidence visualization
- Risk Scoring + Flag Detection

4.0 Create next steps recommendation- Naima

- Map categories to actions
- Implement recommendation logic
- Design action presentation
- Resource Mapping (next steps templates)
- Convex Storage (results + metadata)

5.0 Build results output- Brandi

- Add confidence score display
- Show recommended next steps
- (Optional) Create results UI- Could add display depending on what UI the other teams are responsible for
- Talk to:
    - Other teams frontend to make sure UI is cohesive
