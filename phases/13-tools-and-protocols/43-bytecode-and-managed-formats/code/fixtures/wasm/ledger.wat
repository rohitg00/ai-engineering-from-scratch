(module
  (import "env" "log" (func $log (param i32)))
  (memory (export "memory") 1)
  (data (i32.const 1024) "F\00D\00C\00B\00A\00")

  (func $percent_change (export "percent_change") (param $before i32) (param $after i32) (result i32)
    (if (result i32) (i32.eqz (local.get $before))
      (then (i32.const 0))
      (else
        (i32.div_s
          (i32.mul (i32.sub (local.get $after) (local.get $before)) (i32.const 100))
          (local.get $before)))))

  (func $grade (export "grade") (param $score i32) (result i32)
    (local $bucket i32)
    (local.set $bucket (i32.div_s (local.get $score) (i32.const 10)))
    (block $done (result i32)
      (block $default
        (block $six
          (block $seven
            (block $eight
              (block $nine
                (br_table $default $default $default $default $default $default $six $seven $eight $nine $nine $default
                  (local.get $bucket)))
              (br $done (i32.const 4)))
            (br $done (i32.const 3)))
          (br $done (i32.const 2)))
        (br $done (i32.const 1)))
      (i32.const 0)))

  (func $total (export "total") (param $values i32) (param $count i32) (result i32)
    (local $sum i32)
    (local $i i32)
    (block $exit
      (loop $next
        (br_if $exit (i32.ge_s (local.get $i) (local.get $count)))
        (local.set $sum
          (i32.add (local.get $sum)
            (i32.load (i32.add (local.get $values) (i32.mul (local.get $i) (i32.const 4))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))
    (local.get $sum))

  (func $grade_label (export "grade_label") (param $score i32) (result i32)
    (local $g i32)
    (local.set $g (call $grade (local.get $score)))
    (call $log (local.get $g))
    (i32.add (i32.const 1024) (i32.mul (local.get $g) (i32.const 2)))))
