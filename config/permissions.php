<?php
// ---------------------------------------------------------
// Role -> allowed module map.
// 'admin' implicitly has access to everything (checked in code).
// A user can only see/use modules listed for their role.
// ---------------------------------------------------------
return [
    'admin'      => ['patients','appointments','staff','payroll','financial','inventory','referral','reports','audit'],
    'doctor'     => ['patients','appointments','referral','reports'],
    'nurse'      => ['patients','appointments','reports'],
    'bhw'        => ['patients','appointments','referral'],
    'frontdesk'  => ['patients','appointments'],
    'pharmacist' => ['inventory','reports'],
    'hr'         => ['staff','payroll','reports'],
    'bookkeeper' => ['financial','reports'],
];
