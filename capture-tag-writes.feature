Feature: Complete capture approval after saving its tags
  Scenario: Approval remains in progress until both additional tags are saved
    Given a local verifier is viewing one pending capture
    And the capture is selected with the additional tags healthy and native
    When the verifier submits approval
    Then approval remains in progress while both tag writes are pending
    When the first tag write finishes
    Then approval remains in progress while the second tag write is pending
    When the second tag write finishes
    Then approval finishes and the capture list refreshes
