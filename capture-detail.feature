Feature: Preserve species and tags loaded concurrently
  Scenario Outline: Capture details retain both fields when the <first> response finishes first
    Given a local verifier opens capture 42 details
    And species and tag requests are both pending
    When the "<first>" response finishes first
    Then its detail is visible while the other response is pending
    When the remaining response finishes
    Then Mango and healthy are both visible in capture details

    Examples:
      | first   |
      | species |
      | tag     |
