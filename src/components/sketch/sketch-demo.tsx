"use client";

import { useState } from "react";
import { SketchButton } from "./sketch-button";
import { SketchCard } from "./sketch-card";
import { SketchHeading } from "./sketch-heading";
import { SketchInput } from "./sketch-input";
import { SketchTextarea } from "./sketch-textarea";
import { SketchFilters } from "./sketch-filters";

export function SketchDemo() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  return (
    <>
      <SketchFilters />
      <div className="min-h-screen sketch-paper p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <SketchCard padding="lg">
            <SketchHeading level={1} underline>
              Sketch Components Demo
            </SketchHeading>
            <p className="sketch-text text-xl mt-4">
              Hand-drawn wireframe components for rapid prototyping! 📝
            </p>
          </SketchCard>

          <SketchCard>
            <SketchHeading level={2} scribble>
              Interactive Counter
            </SketchHeading>

            <div className="mt-6 flex items-center gap-4">
              <SketchButton onClick={() => setCount(count - 1)}>-</SketchButton>
              <div className="sketch-border px-8 py-4">
                <span className="sketch-text text-3xl font-bold">{count}</span>
              </div>
              <SketchButton onClick={() => setCount(count + 1)}>+</SketchButton>
            </div>

            <div className="mt-4">
              <SketchButton
                variant="heavy"
                onClick={() => setCount(0)}
                className="w-full"
              >
                Reset Counter
              </SketchButton>
            </div>
          </SketchCard>

          <SketchCard>
            <SketchHeading level={2} highlight>
              Contact Form
            </SketchHeading>

            <div className="mt-6 space-y-4">
              <SketchInput
                label="Your Name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <SketchTextarea
                label="Your Message"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
              />

              <SketchButton
                onClick={() => {
                  if (name && message) {
                    alert(`Thanks ${name}! We got your message: "${message}"`);
                    setName("");
                    setMessage("");
                  } else {
                    alert("Please fill out all fields!");
                  }
                }}
                className="w-full"
              >
                Send Message
              </SketchButton>
            </div>
          </SketchCard>

          <SketchCard>
            <SketchHeading level={2}>Text Decorations</SketchHeading>

            <div className="mt-6 space-y-4">
              <div>
                <SketchHeading level={3} underline>
                  Underlined Heading
                </SketchHeading>
              </div>

              <div>
                <SketchHeading level={3} scribble>
                  Scribbled Heading
                </SketchHeading>
              </div>

              <div>
                <SketchHeading level={3} highlight>
                  Highlighted Heading
                </SketchHeading>
              </div>

              <p className="sketch-text text-lg">
                Mix and match with{" "}
                <span className="sketch-highlight">highlighted text</span> and{" "}
                <span className="sketch-underline">underlined phrases</span>!
              </p>
            </div>
          </SketchCard>

          <SketchCard>
            <SketchHeading level={2}>Button Variants</SketchHeading>

            <div className="mt-6 flex flex-wrap gap-4">
              <SketchButton onClick={() => alert("Default!")}>
                Default
              </SketchButton>
              <SketchButton variant="heavy" onClick={() => alert("Heavy!")}>
                Heavy Border
              </SketchButton>
              <SketchButton
                className="bg-blue-200"
                onClick={() => alert("Custom!")}
              >
                Custom Color
              </SketchButton>
            </div>
          </SketchCard>

          <SketchCard>
            <SketchHeading level={2}>Intensity Levels</SketchHeading>

            <div className="mt-6 space-y-6">
              <div className="sketch-light p-4 border-2 border-black bg-white">
                <p className="sketch-text text-lg">
                  Light sketch effect - subtle wobble
                </p>
              </div>

              <div className="sketch-medium p-4 border-2 border-black bg-white">
                <p className="sketch-text text-lg">
                  Medium sketch effect - more wobbly
                </p>
              </div>

              <div className="sketch-heavy p-4 border-2 border-black bg-white">
                <p className="sketch-text text-lg">
                  Heavy sketch effect - very hand-drawn!
                </p>
              </div>
            </div>
          </SketchCard>

          <div className="sketch-border-heavy p-6 bg-white">
            <p className="sketch-text text-center text-xl">
              Perfect for wireframes, prototypes, and rapid development! 🎨
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
