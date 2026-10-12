## ADDED Requirements

### Requirement: Malformed worker replies reject the job
The system SHALL validate that a worker's reply to an encode job is a well-formed encode result (an encoded buffer plus its sizes) before resolving the job. A reply that is missing, or that lacks an encoded buffer, SHALL reject that job with a descriptive error and SHALL be handled like any other per-file failure: the file is marked errored, the worker returns to the pool, and the remaining jobs in a batch continue.

#### Scenario: Worker returns no result
- **WHEN** a worker's reply to an encode job resolves without an encoded buffer
- **THEN** that file shows a per-file error describing an invalid worker result, and no uncaught exception is raised on the main thread

#### Scenario: Batch continues past a malformed reply
- **WHEN** one job in an Optimize-all batch receives a malformed reply
- **THEN** every other job in the batch still completes and reports its own result
