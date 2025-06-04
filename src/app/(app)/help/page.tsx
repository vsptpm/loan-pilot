
'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, BookOpen } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="text-center">
        <HelpCircle className="mx-auto h-12 w-12 text-primary mb-4" />
        <h1 className="text-3xl font-headline tracking-tight">Help & Support</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to the LoanPilot Help Center. Find answers to common questions and guides below.
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center">
            <BookOpen className="mr-2 h-5 w-5 text-accent" />
            Frequently Asked Questions (FAQ)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left hover:no-underline">How do I add a new loan?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                To add a new loan, you can navigate to the "Dashboard" and click the "Add New Loan" button, or go to the "Loans" page from the sidebar and click the "+ Add New Loan" button there.
                You will be prompted to fill out a form with the following details:
                <ul class="list-disc list-inside pl-4 mt-2">
                  <li><strong>Loan Name:</strong> A descriptive name for your loan (e.g., "Car Loan", "Personal Loan from Bank X").</li>
                  <li><strong>Principal Amount:</strong> The total amount borrowed.</li>
                  <li><strong>Annual Interest Rate:</strong> The yearly interest rate for the loan.</li>
                  <li><strong>Loan Term / Duration:</strong> The length of the loan.</li>
                  <li><strong>Duration Type:</strong> Specify if the term is in "Years" or "Months".</li>
                  <li><strong>Loan Start Date:</strong> The date when your loan officially began.</li>
                  <li><strong>Amount Already Paid (Optional):</strong> If you're adding a loan that's already in progress, enter the total sum of regular EMIs you've paid *before* adding it to LoanPilot. This helps the app calculate your current status accurately. Do not include prepayments here; they should be recorded separately.</li>
                </ul>
                Once all details are filled in, click the "Add Loan" button to save it.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left hover:no-underline">How can I edit an existing loan?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You can modify the details of any loan you've added.
                <br />
                1. Go to the "Loans" page from the sidebar. This will list all your loans.
                <br />
                2. Find the loan you want to edit. On the loan card, click the "More" icon (three vertical dots).
                <br />
                3. Select "Edit" from the dropdown menu.
                <br />
                Alternatively, if you are on a specific loan's detail page (accessed by clicking a loan from the list), you will find an "Edit" button usually near the top of the page.
                <br />
                Clicking "Edit" will take you to the loan form, pre-filled with the existing details. You can update any field, such as the name, principal, interest rate, term, or start date. After making your changes, click "Save Changes".
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left hover:no-underline">How do I record a prepayment?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Recording a prepayment helps LoanPilot accurately calculate your loan's progress and potential early closure.
                <br />
                1. Navigate to the specific loan you want to record a prepayment for. You can do this by clicking on the loan from the "Loans" list or from the dashboard. This will take you to the loan's detail page.
                <br />
                2. On the loan detail page, look for a button labeled "Record Prepayment".
                <br />
                3. Click this button. A dialog or form will appear asking for:
                    <ul class="list-disc list-inside pl-4 mt-2">
                      <li><strong>Prepayment Amount:</strong> The amount you paid in addition to your regular EMI.</li>
                      <li><strong>Prepayment Date:</strong> The date the prepayment was made.</li>
                      <li><strong>Notes (Optional):</strong> Any relevant notes about this prepayment (e.g., "From annual bonus").</li>
                    </ul>
                4. Fill in the details and click "Record Prepayment" or "Save". The prepayment will be logged, and your loan's outstanding balance and repayment schedule will be updated to reflect it. The total prepayment amount for the loan will also be updated.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left hover:no-underline">What does the &quot;Amount Already Paid&quot; field mean when adding a loan?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The "Amount Already Paid" field is an optional field available when you first add a loan. It's designed for situations where you're adding a loan to LoanPilot that you've already been paying for some time.
                <br /><br />
                Enter the total sum of regular Equated Monthly Installments (EMIs) that you have already paid *before* you started tracking this loan in LoanPilot. This value helps the application correctly calculate how many EMIs are considered paid from the beginning of the loan term and establish a more accurate starting point for the current outstanding balance.
                <br /><br />
                <strong>Important:</strong> This field should <em>not</em> be used for recording prepayments or lump-sum payments made in addition to your regular EMIs. Prepayments should be recorded separately using the "Record Prepayment" feature on the loan's detail page after the loan has been added.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left hover:no-underline">What&apos;s the difference between Prepayment Simulator and What-if Analyzer?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Both tools help you plan your loan repayments, but they focus on different scenarios:
                <br /><br />
                The <strong>Prepayment Simulator</strong> is designed to show you the impact of making additional payments (prepayments) towards your loan, either as a one-time lump sum or as recurring additional payments. It calculates how these prepayments can:
                <ul class="list-disc list-inside pl-4 mt-1">
                  <li>Shorten your loan tenure (i.e., help you pay off the loan faster).</li>
                  <li>Reduce the total amount of interest you pay over the life of the loan.</li>
                </ul>
                You input the prepayment amount (or percentage of balance) and timing, and the simulator shows the new projected closure date and interest savings.
                <br /><br />
                The <strong>What-if Analyzer</strong>, on the other hand, lets you explore how changing your regular Equated Monthly Installment (EMI) amount would affect your loan. For example, if you decide to permanently increase your monthly EMI, this tool will show you:
                <ul class="list-disc list-inside pl-4 mt-1">
                  <li>The new, earlier projected loan closure date.</li>
                  <li>The total interest you would save by paying a higher EMI.</li>
                </ul>
                It helps you understand the benefits of consistently paying more than your scheduled EMI.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-left hover:no-underline">How is the repayment schedule generated?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The repayment schedule displayed on a loan's detail page is dynamically generated based on several factors:
                <ul class="list-disc list-inside pl-4 mt-2">
                    <li><strong>Original Loan Terms:</strong> Your loan's principal amount, annual interest rate, original loan term (duration in months), and start date form the baseline.</li>
                    <li><strong>Amount Initially Paid:</strong> If you provided a value for "Amount Already Paid" when adding the loan, the schedule marks a corresponding number of initial EMIs as paid.</li>
                    <li><strong>Recorded Prepayments:</strong> All prepayments you've recorded for the loan are factored in. When a prepayment is made, it reduces the outstanding principal balance. The schedule then recalculates subsequent interest charges based on this new lower balance, which typically leads to the loan being paid off sooner or a reduction in the number of EMIs.</li>
                    <li><strong>Assumption of On-Time Payments:</strong> The schedule assumes that all regular EMIs due up to the current date have been paid on time. If an EMI's due date is in the past or is today, it's marked as "Paid" in the schedule.</li>
                </ul>
                This provides a current, projected view of your loan repayment, showing how much of each payment goes towards principal and interest, and what your remaining balance will be after each payment. The final entry in the schedule shows when the loan is projected to be fully paid off.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

       {/* Placeholder for Key Features Guide - You can add this later */}
       {/* 
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center">
                    Key Features Guide
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    Detailed explanations of LoanPilot's main tools will be here.
                </p>
            </CardContent>
        </Card>
       */}
    </div>
  );
}
