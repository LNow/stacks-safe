(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))
(define-constant DEPLOYED_AT block-height)

(define-constant ERR_EMPTY_LIST (err u61001))

(define-map TaskArgs
  uint ;; taskId
  (list 30 principal)
)

(define-read-only (get-args (taskId uint))
  (map-get? TaskArgs taskId)
)

;; #[allow(unchecked_data)]
(define-public (create (owners (list 30 principal)))
  (let
    ((taskId (try! (contract-call? .safe create-task))))
    (asserts! (> (len owners) u0) ERR_EMPTY_LIST)
    (map-insert TaskArgs taskId owners)
    (ok taskId)
  )
)

(define-public (execute (taskId uint))
  (begin
    (try! (contract-call? .safe execute-task taskId))
    (contract-call? .safe add-owners (unwrap-panic (get-args taskId)))
  )
)
