
'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, BookOpen, AlertCircle } from 'lucide-react';

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
                You can add a new loan by navigating to the "Dashboard" page and clicking the "Add New Loan" button, or by going to the "Loans" page from the sidebar and clicking the "+ Add New Loan" button there. You&apos;ll need to provide details such as the loan name, principal amount, annual interest rate, loan term (duration and type - years/months), and the loan&apos;s start date.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left hover:no-underline">How can I edit an existing loan?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                To edit a loan, go to the "Loans" page. Each loan card has a "More" (three vertical dots) icon. Click it and select "Edit". Alternatively, from a loan's detail page, click the "Edit" button near the top. You can then update any of the loan&apos;s details.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left hover:no-underline">How do I record a prepayment?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                First, navigate to the specific loan&apos;s detail page by clicking on the loan from the "Loans" list or the dashboard. On the loan detail page, you will find a "Record Prepayment" button. Click this button, fill in the prepayment amount, the date the prepayment was made, and any optional notes, then save.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left hover:no-underline">What does the &quot;Amount Already Paid&quot; field mean when adding a loan?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The "Amount Already Paid" field is optional. Use it if you started tracking your loan in LoanPilot after you had already made some EMI payments. Enter the total sum of EMI payments you&apos;ve made *before* adding the loan to the app. This helps LoanPilot correctly calculate the number of EMIs already paid and the current outstanding balance based on the original loan terms. It does not refer to prepayments; those should be recorded separately.
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-5">
              <AccordionTrigger className="text-left hover:no-underline">What&apos;s the difference between Prepayment Simulator and What-if Analyzer?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The <strong>Prepayment Simulator</strong> helps you see the impact of making additional one-time or recurring payments towards your loan. It shows how such prepayments can shorten your loan tenure and reduce the total interest paid.
                <br /><br />
                The <strong>What-if Analyzer</strong> lets you explore how changing your regular Equated Monthly Installment (EMI) amount (e.g., increasing it) would affect your loan&apos;s repayment timeline and overall interest costs.
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-6">
              <AccordionTrigger className="text-left hover:no-underline">How is the repayment schedule generated?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The repayment schedule on a loan&apos;s detail page is dynamically generated based on your loan&apos;s principal, interest rate, original term, start date, any amount you initially specified as already paid, and all recorded prepayments. It assumes that all scheduled EMIs due up to the current date have been paid on time. This provides a current, projected view of your loan repayment.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center">
             <AlertCircle className="mr-2 h-5 w-5 text-accent" />
            More Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This help page is currently a work in progress. More sections will be added soon, including:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 pl-4">
            <li>Detailed guides for each Key Feature.</li>
            <li>A glossary of common Loan Terms.</li>
            <li>Troubleshooting tips.</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Thank you for using LoanPilot!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
